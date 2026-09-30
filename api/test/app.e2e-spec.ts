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

  it('POST /auth/login rejects a body with no password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
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
});
