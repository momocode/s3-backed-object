const chai = require('chai')
chai.use(require('chai-spies'))
const {expect} = chai

const S3Object = require('../index.js')

describe('s3-backed-object', () => {
  describe('get', () => {
    it('should deserialize and return object from S3 when called', async () => {
      const s3 = chai.spy.interface({
        getObject: () => ({
          promise: () => Promise.resolve({
            ETag: 'etag',
            Body: Buffer.from(JSON.stringify({a: 'property'}))
          })
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      expect(await obj.get()).to.deep.equal({a: 'property'})
    })
    it('should return null if object is not found in S3', async () => {
      const s3 = chai.spy.interface({
        getObject: () => ({
          promise: () => Promise.reject(awserror({statusCode: 404}))
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      expect(await obj.get()).to.be.null
    })
    it('should keep object in memory and use ETag to check for modification', async () => {
      const s3 = chai.spy.interface({
        getObject: ({IfNoneMatch}) => ({
          promise: async () => {
            if (IfNoneMatch === 'etag')
              throw awserror({statusCode: 304})
            return {
              Body: Buffer.from(JSON.stringify({a: 'property'})),
              ETag: 'etag'
            }
          }
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      expect(await obj.get()).to.deep.equal({a: 'property'})
      expect(await obj.get()).to.deep.equal({a: 'property'})
      expect(s3.getObject).first.called.with({
        Bucket: 'bucket',
        Key: 'key'
      })
      expect(s3.getObject).second.called.with({
        Bucket: 'bucket',
        Key: 'key',
        IfNoneMatch: 'etag'
      })
    })
  })
  describe('set', () => {
    it('should store object in S3', async () => {
      const s3 = chai.spy.interface({
        putObject: () => ({
          promise: () => Promise.resolve({ETag: 'etag'})
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      expect(await obj.set({a: 'property'})).to.be.undefined
      expect(s3.putObject).to.have.been.called.once.with({
        Bucket: 'bucket',
        Key: 'key',
        Body: JSON.stringify({a: 'property'})
      })
    })
  })
  describe('set/get', () => {
    it('set should cache object and get use ETag returned by putObject ', async () => {
      const s3 = chai.spy.interface({
        getObject: ({IfNoneMatch}) => ({
          promise: async () => {
            if (IfNoneMatch === 'etag')
              throw awserror({statusCode: 304})
            return {
              Body: Buffer.from(JSON.stringify({a: 'property'})),
              ETag: 'etag'
            }
          }
        }),
        putObject: () => ({
          promise: async () => ({ETag: 'etag'})
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      await obj.set({a: 'property'})
      expect(s3.putObject).to.have.been.called()
      expect(await obj.get()).to.deep.equal({a: 'property'})
      expect(s3.getObject).to.have.been.called.with({
        Bucket: 'bucket',
        Key: 'key',
        IfNoneMatch: 'etag'
      })
    })
  })
  describe('object deep clone', () => {
    it('modifications to obj after calling set(obj) should not be present in cache', async () => {
      const s3 = chai.spy.interface({
        getObject: ({IfNoneMatch}) => ({
          promise: async () => {
            if (IfNoneMatch === 'etag')
              throw awserror({statusCode: 304})
            throw new Error('unexpected call')
          }
        }),
        putObject: () => ({
          promise: async () => ({ETag: 'etag'})
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      const instance = {prop: 'value', nested: { prop: 'value' }}
      await obj.set(instance)
      instance.prop = 'new value'
      instance.nested.prop = 'new value'
      expect(await obj.get()).to.deep.equal({prop: 'value', nested: {prop: 'value'}})
    })
    it('modifications to obj after obtaining it from get() should not be present in cache', async () => {
      const s3 = chai.spy.interface({
        getObject: ({IfNoneMatch}) => ({
          promise: async () => {
            if (IfNoneMatch === 'etag')
              throw awserror({statusCode: 304})
            return {
              Body: Buffer.from(JSON.stringify({prop: 'value', nested: {prop: 'value'}})),
              ETag: 'etag'
            }
          }
        }),
        putObject: () => ({
          promise: async () => ({ETag: 'etag'})
        })
      })
      const obj = new S3Object({bucket: 'bucket', key: 'key'}, undefined, {s3})
      const instance = await obj.get()
      expect(instance).to.deep.equal({prop: 'value', nested: {prop: 'value'}})
      instance.prop = 'new value'
      instance.nested.prop = 'new value'
      expect(await obj.get()).to.deep.equal({prop: 'value', nested: {prop: 'value'}})
      expect(s3.getObject).second.called.with({Bucket: 'bucket', Key: 'key', IfNoneMatch: 'etag'})
    })
  })
})

function awserror (props) {
  return Object.assign(new Error(), props)
}
