import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, mp3, uploadFile, uuid, type App, type Client } from './harness'

let app: App
let daniel: Client
let vee: Client
beforeEach(async () => {
  app = await createApp()
  daniel = await app.session('daniel')
  vee = await app.session('vee')
})

const TODAY = '2025-06-01'

describe('important dates', () => {
  it('both people see a shared date; only its author can remove it', async () => {
    const made = await daniel.post('/dates', { title: 'Our anniversary', date: '2023-09-14', kind: 'anniversary' })
    expect(made.status).toBe(200)
    expect(made.body.yearly).toBe(true) // anniversaries repeat by default
    expect((await vee.get('/dates')).body.map((d: any) => d.title)).toEqual(['Our anniversary'])
    expect((await vee.del(`/dates/${made.body.id}`)).status).toBe(404)
    expect((await daniel.del(`/dates/${made.body.id}`)).status).toBe(200)
    expect((await vee.get('/dates')).body).toEqual([])
  })

  it('refuses impossible dates, unknown kinds, empty titles, and too many', async () => {
    expect((await daniel.post('/dates', { title: 'x', date: '2025-02-30' })).status).toBe(400)
    expect((await daniel.post('/dates', { title: 'x', date: 'tomorrow' })).status).toBe(400)
    expect((await daniel.post('/dates', { title: 'x', date: TODAY, kind: 'party' })).status).toBe(400)
    expect((await daniel.post('/dates', { title: '   ', date: TODAY })).status).toBe(400)
    for (let i = 0; i < 100; i++) expect((await daniel.post('/dates', { title: `d${i}`, date: TODAY, kind: 'countdown' })).status).toBe(200)
    expect((await daniel.post('/dates', { title: 'one more', date: TODAY })).status).toBe(409)
  })

  it('a change reaches the partner through the sync versions', async () => {
    await daniel.post('/dates', { title: 'Trip', date: '2025-08-01', kind: 'countdown' })
    const sync = await vee.get('/sync')
    expect(Object.keys(sync.body.versions)).toContain('important_dates')
  })
})

describe('daily question', () => {
  it('everyone gets the same question for a day, and it changes on the next day', async () => {
    const a = (await daniel.get(`/daily?day=${TODAY}`)).body
    const b = (await vee.get(`/daily?day=${TODAY}`)).body
    expect(a.question).toBe(b.question)
    expect((await daniel.get('/daily?day=2025-06-02')).body.question).not.toBe(a.question)
  })

  it('keeps each answer secret until both have answered', async () => {
    await daniel.put('/daily', { day: TODAY, answer: 'the rain on the window' })
    const veeBefore = (await vee.get(`/daily?day=${TODAY}`)).body
    expect(veeBefore).toMatchObject({ mine: null, partnerAnswered: true, partner: null })
    expect(JSON.stringify(veeBefore)).not.toContain('rain on the window')
    await vee.put('/daily', { day: TODAY, answer: 'your laugh' })
    expect((await vee.get(`/daily?day=${TODAY}`)).body).toMatchObject({ mine: 'your laugh', partner: 'the rain on the window' })
    expect((await daniel.get(`/daily?day=${TODAY}`)).body).toMatchObject({ mine: 'the rain on the window', partner: 'your laugh' })
  })

  it('lets you reword an answer until the other person has answered, then locks both', async () => {
    expect((await daniel.put('/daily', { day: TODAY, answer: 'first' })).status).toBe(200)
    expect((await daniel.put('/daily', { day: TODAY, answer: 'second' })).status).toBe(200)
    await vee.put('/daily', { day: TODAY, answer: 'mine' })
    expect((await daniel.put('/daily', { day: TODAY, answer: 'third' })).status).toBe(409)
    expect((await daniel.get(`/daily?day=${TODAY}`)).body.mine).toBe('second')
  })

  it('refuses days far from the server clock, bad days, and empty answers; history shows only complete days', async () => {
    expect((await daniel.get('/daily?day=2030-01-01')).status).toBe(400)
    expect((await daniel.get('/daily?day=nope')).status).toBe(400)
    expect((await daniel.put('/daily', { day: TODAY, answer: '  ' })).status).toBe(400)
    await daniel.put('/daily', { day: TODAY, answer: 'a' })
    expect((await daniel.get('/daily/history')).body).toEqual([])
    await vee.put('/daily', { day: TODAY, answer: 'b' })
    const history = (await daniel.get('/daily/history')).body
    expect(history).toHaveLength(1)
    expect(history[0].answers).toEqual({ daniel: 'a', vee: 'b' })
  })
})

describe('sealed notes', () => {
  const place = (client: Client, extra: Record<string, unknown>) => client.post('/notes', { clientNoteId: uuid(), objectId: 'obj_letter_desk', body: 'read me later', reveal: 'fade', ...extra })

  it('the recipient never receives the text before the seal opens, and cannot mark it read', async () => {
    const note = (await place(daniel, { unlockOn: '2025-06-10' })).body
    const seen = (await vee.get('/notes')).body[0]
    expect(seen).toMatchObject({ sealed: true, unlockOn: '2025-06-10', body: '' })
    expect(JSON.stringify((await vee.get('/notes')).body)).not.toContain('read me later')
    expect((await vee.post(`/notes/${note.id}/read`)).status).toBe(409)
    expect((await daniel.get('/notes')).body[0].body).toBe('read me later') // the author keeps their own text
  })

  it('opens on the day', async () => {
    const note = (await place(daniel, { unlockOn: '2025-06-03' })).body
    app.advance(2 * 86_400_000)
    expect((await vee.get('/notes')).body[0]).toMatchObject({ sealed: false, body: 'read me later' })
    expect((await vee.post(`/notes/${note.id}/read`)).status).toBe(200)
  })

  it('refuses impossible, past and far-future seal dates; notes without one work as before', async () => {
    expect((await place(daniel, { unlockOn: '2025-02-31' })).status).toBe(400)
    expect((await place(daniel, { unlockOn: '2020-01-01' })).status).toBe(400)
    expect((await place(daniel, { unlockOn: '2031-01-01' })).status).toBe(400)
    const plain = await place(daniel, {})
    expect(plain.status).toBe(200)
    expect((await vee.get('/notes')).body[0]).toMatchObject({ sealed: false, body: 'read me later' })
  })
})

describe('our song', () => {
  async function track(client: Client): Promise<string> {
    const audio = await uploadFile(client, 'music', 'audio/mpeg', mp3())
    return (await client.post('/tracks', { title: 'Song', artist: 'Us', audioFileId: audio.id, coverFileId: null, durationMs: 1000 })).body.id
  }

  it('records a heart per person and removes it again', async () => {
    const id = await track(daniel)
    expect((await vee.put(`/tracks/${id}/love`, { loved: true })).status).toBe(200)
    expect((await daniel.get('/tracks')).body[0].lovedBy).toEqual(['vee'])
    await daniel.put(`/tracks/${id}/love`, { loved: true })
    expect((await daniel.get('/tracks')).body[0].lovedBy.sort()).toEqual(['daniel', 'vee'])
    await vee.put(`/tracks/${id}/love`, { loved: false })
    expect((await daniel.get('/tracks')).body[0].lovedBy).toEqual(['daniel'])
  })

  it('refuses unknown tracks and non-boolean values; deleting the track forgets its hearts', async () => {
    const id = await track(daniel)
    expect((await vee.put(`/tracks/${uuid()}/love`, { loved: true })).status).toBe(404)
    expect((await vee.put(`/tracks/${id}/love`, { loved: 'yes' })).status).toBe(400)
    await vee.put(`/tracks/${id}/love`, { loved: true })
    await daniel.del(`/tracks/${id}`)
    expect(await app.store.list('trackloves/')).toEqual([])
  })
})
