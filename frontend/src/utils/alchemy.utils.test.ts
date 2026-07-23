/**
 * The Alchemy key travels as a URL path segment, so these assert that no error
 * path can carry it into the logs.
 *
 *   npx tsx src/utils/alchemy.utils.test.ts
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { AxiosError } from 'axios'
import { describeAlchemyError } from './alchemy.utils'

const KEY = 'alcht_S3cretKeyValue123'
const URL = `https://api.g.alchemy.com/data/v1/${KEY}/assets/tokens/by-address`

const axiosErrorWith = (over: Partial<AxiosError> = {}): AxiosError => {
  const err = new AxiosError(over.message ?? 'Request failed with status code 401', over.code)
  err.config = { url: URL, headers: {} } as AxiosError['config']
  Object.assign(err, over)
  return err
}

test('an upstream rejection reports its status without the key', () => {
  const out = describeAlchemyError(
    axiosErrorWith({ response: { status: 401, data: { error: 'bad key' } } as AxiosError['response'] }),
    KEY,
  )
  assert.ok(!out.includes(KEY), out)
  assert.match(out, /status=401/)
})

test('a transport failure reports its code without the key', () => {
  const out = describeAlchemyError(axiosErrorWith({ message: 'timeout of 15000ms exceeded', code: 'ECONNABORTED' }), KEY)
  assert.ok(!out.includes(KEY), out)
  assert.match(out, /code=ECONNABORTED/)
})

test('a key echoed inside the message is masked, not passed through', () => {
  const out = describeAlchemyError(new Error(`connect ECONNREFUSED while calling ${URL}`), KEY)
  assert.ok(!out.includes(KEY), out)
  assert.match(out, /\*\*\*/)
})

test('serialising the whole error — what the old handler did — would have leaked it', () => {
  assert.ok(JSON.stringify(axiosErrorWith().toJSON()).includes(KEY))
})

test('an unset key does not shred the message into characters', () => {
  assert.equal(describeAlchemyError(new Error('boom'), ''), 'boom')
})

test('a non-Error rejection is still summarised', () => {
  assert.equal(describeAlchemyError('plain string', KEY), 'plain string')
})
