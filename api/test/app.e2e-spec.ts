import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { OWNER_ID } from './../src/auth/owner';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Same pipe as main.ts, so validation behaves as it does in production.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { exposeUnsetFields: false },
      }),
    );
    await app.init();

    const token = await app.get(JwtService).signAsync({ sub: OWNER_ID });
    auth = { Authorization: `Bearer ${token}` };
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health responds without auth', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ ok: true });
  });

  it('GET /pantry rejects a request with no token', () => {
    return request(app.getHttpServer()).get('/pantry').expect(401);
  });

  describe('JwtAuthGuard', () => {
    const getPantry = (authorization: string) =>
      request(app.getHttpServer())
        .get('/pantry')
        .set('Authorization', authorization);

    it('accepts a valid token', () => {
      return getPantry(auth.Authorization).expect(200);
    });

    it('rejects a malformed token', () => {
      return getPantry('Bearer not-a-jwt').expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'someone-elses-secret',
      }).signAsync({ sub: OWNER_ID });
      return getPantry(`Bearer ${forged}`).expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = await app
        .get(JwtService)
        .signAsync({ sub: OWNER_ID }, { expiresIn: '-1s' });
      return getPantry(`Bearer ${expired}`).expect(401);
    });

    it('requires the Bearer scheme', () => {
      return getPantry(auth.Authorization.replace('Bearer ', 'Token ')).expect(
        401,
      );
    });
  });

  it('POST /auth/login rejects a body with no password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
  });

  it('POST /auth/login limits repeated attempts', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'wrong' });
    for (let i = 0; i < 5; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });

  it('POST /chat rejects malformed messages', () => {
    return request(app.getHttpServer())
      .post('/chat')
      .set(auth)
      .send({ messages: [{ role: 'system', content: 'hi' }] })
      .expect(400);
  });

  describe('PATCH /pantry/:id', () => {
    let id: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/pantry')
        .set(auth)
        .send({ ingredient: 'Parmesan', quantity: 2, unit: 'wedge' })
        .expect(201);
      id = (res.body as { id: string }).id;
    });

    it('clears nullable fields when sent null', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pantry/${id}`)
        .set(auth)
        .send({ quantity: null, unit: null })
        .expect(200);
      expect(res.body).toMatchObject({
        ingredient: 'Parmesan',
        quantity: null,
        unit: null,
      });
    });

    it('changes only the fields that were sent', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pantry/${id}`)
        .set(auth)
        .send({ lowStock: true })
        .expect(200);
      expect(res.body).toMatchObject({
        ingredient: 'Parmesan',
        quantity: 2,
        unit: 'wedge',
        lowStock: true,
      });
    });

    it('returns 404 for an unknown item', () => {
      return request(app.getHttpServer())
        .patch('/pantry/does-not-exist')
        .set(auth)
        .send({ lowStock: true })
        .expect(404);
    });

    it.each(['ingredient', 'lowStock', 'category'])(
      'rejects null for required field %s',
      (field) => {
        return request(app.getHttpServer())
          .patch(`/pantry/${id}`)
          .set(auth)
          .send({ [field]: null })
          .expect(400);
      },
    );
  });

  describe('POST /pantry/batch', () => {
    type Item = { id: string; ingredient: string; quantity: number | null };

    async function addItem(ingredient: string, quantity: number) {
      const res = await request(app.getHttpServer())
        .post('/pantry')
        .set(auth)
        .send({ ingredient, quantity })
        .expect(201);
      return (res.body as Item).id;
    }

    async function ingredients() {
      const res = await request(app.getHttpServer())
        .get('/pantry')
        .set(auth)
        .expect(200);
      return (res.body as Item[]).map((item) => item.ingredient);
    }

    // The in-memory database is shared across tests in this file.
    beforeEach(async () => {
      const res = await request(app.getHttpServer()).get('/pantry').set(auth);
      for (const item of res.body as Item[]) {
        await request(app.getHttpServer())
          .delete(`/pantry/${item.id}`)
          .set(auth);
      }
    });

    it('creates, updates, and deletes together', async () => {
      const milk = await addItem('Milk', 1);
      const eggs = await addItem('Eggs', 12);

      const res = await request(app.getHttpServer())
        .post('/pantry/batch')
        .set(auth)
        .send({
          create: [{ ingredient: 'Black beans', quantity: 2, unit: 'can' }],
          update: [{ id: eggs, quantity: 9 }],
          delete: [milk],
        })
        .expect(201);

      const body = res.body as {
        created: Item[];
        updated: Item[];
        deleted: string[];
      };
      expect(body.created).toMatchObject([
        { ingredient: 'Black beans', quantity: 2 },
      ]);
      expect(body.updated).toMatchObject([{ id: eggs, quantity: 9 }]);
      expect(body.deleted).toEqual([milk]);
      expect((await ingredients()).sort()).toEqual(['Black beans', 'Eggs']);
    });

    it('writes nothing when an item to change does not exist', async () => {
      const milk = await addItem('Milk', 1);

      await request(app.getHttpServer())
        .post('/pantry/batch')
        .set(auth)
        .send({
          create: [{ ingredient: 'Black beans' }],
          delete: [milk, 'does-not-exist'],
        })
        .expect(404);

      expect(await ingredients()).toEqual(['Milk']);
    });

    it('rejects an invalid item anywhere in the batch', () => {
      return request(app.getHttpServer())
        .post('/pantry/batch')
        .set(auth)
        .send({ create: [{ ingredient: 'Rice' }, { ingredient: '' }] })
        .expect(400);
    });
  });

  describe('POST /pantry/ai/cooked', () => {
    it.each([
      ['neither a url nor ingredients', {}],
      [
        'both a url and ingredients',
        { url: 'https://example.com/r', ingredientsText: '2 eggs' },
      ],
      ['a url without a protocol', { url: 'example.com/recipe' }],
      ['servings out of range', { ingredientsText: '2 eggs', servings: 0 }],
    ])('rejects %s', (_label, body) => {
      return request(app.getHttpServer())
        .post('/pantry/ai/cooked')
        .set(auth)
        .send(body)
        .expect(400);
    });
  });

  describe('POST /pantry/ai/receipt', () => {
    it('requires a file or text', () => {
      return request(app.getHttpServer())
        .post('/pantry/ai/receipt')
        .set(auth)
        .field('text', '  ')
        .expect(400);
    });

    it('rejects a file type Claude cannot read', () => {
      return request(app.getHttpServer())
        .post('/pantry/ai/receipt')
        .set(auth)
        .attach('files', Buffer.from('a,b'), {
          filename: 'receipt.csv',
          contentType: 'text/csv',
        })
        .expect(400);
    });
  });
});
