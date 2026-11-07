import test from 'node:test';
import assert from 'node:assert/strict';
import { emailFields, sendEmailReply, EMAIL_ENDPOINT } from '../src/email-reply.mjs';

const details = { date: '2026-11-08', time: '18:30', activity: 'Боулинг и шоколад', location: 'У моста', coordinates: { lat: 59.9343, lng: 30.3158 } };

test('email contains all choices, precise coordinates and the complete ticket', async () => {
  const fields = emailFields(details);
  assert.match(fields['Время'], /18:30/);
  assert.equal(fields['Занятие'], details.activity);
  assert.match(fields['Карта'], /30.3158,59.9343/);
  await sendEmailReply(details, { request: async (url, init) => {
    assert.equal(url, EMAIL_ENDPOINT);
    assert.equal(init.method, 'POST');
    assert.equal(init.body.get('Место'), details.location);
    assert.match(init.body.get('message'), /Боулинг и шоколад/);
    return Response.json({ ok: true });
  } });
});
test('email delivery rejects server, activation and network failures', async () => {
  for (const request of [
    async () => Response.json({}, { status: 500 }),
    async () => Response.json({ ok: false }),
    async () => { throw new TypeError('offline'); },
  ]) await assert.rejects(sendEmailReply(details, { request }));
});
