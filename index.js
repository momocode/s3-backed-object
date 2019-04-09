
class S3Object {
  constructor ({bucket, key} = {}, s3Options, {s3} = {}) {
    if (typeof bucket !== 'string')
      throw new Error('bucket option must be given')
    if (typeof key !== 'string')
      throw new Error('key option must be given')
    this._s3 = s3 || getS3Client(s3Options)
    this.bucket = bucket
    this.key = key
  }

  async get () {
    let data
    try {
      const opts = {
        Bucket: this.bucket,
        Key: this.key
      }
      if (this.cached)
        opts.ETag = this.cached.ETag
      data = await this._s3.getObject(opts).promise()
    } catch (err) {
      if (err.statusCode === 404)
        return null
      if (err.statusCode === 304)
        return this.cached.data
      throw err
    }
    const obj = JSON.parse(data.Body)
    this.cached = {
      ETag: data.ETag,
      data: obj
    }
    return obj
  }

  async set (obj) {
    const response = await this._s3.putObject({
      Bucket: this.bucket,
      Key: this.key,
      Body: JSON.stringify(obj)
    }).promise()
    this.cached = {
      ETag: response.ETag,
      data: obj
    }
  }
}

module.exports = S3Object

function getS3Client (options = {}) {
  const AWS = require('aws-sdk')
  return new AWS.S3(Object.assign({}, options, {
    apiVersion: '2006-03-01'
  }))
}
