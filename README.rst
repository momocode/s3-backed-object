s3-backed-object
================

S3-backed-object is a small wrapper that takes bucket and key in constructor
and provides `set` and `get` methods for accessing the encapsulated object. The
object is cached in memory from last `set` or `get` call, but on every `get` a
call to S3 is made to ensure that the version in memory is the latest.

Usage
-----

This module makes use of async/await and requires Node 8 at minimum to run.

Both `get` and `set` return a `Promise`. Any errors (expect 404 when getting,
and 304 when not modified) from S3 are forwarded as-is.

Basic usage::

   S3Object = require('s3-backed-object')
   const obj = new S3Object({bucket: 'bucket', key: 'key'}, {region: 'eu-west-1'})
   await obj.set({hello: 'world'})
   // The object is now stored as s3://bucket/key and obj instance remembers
   // the ETag returned by s3.putObject.
   await obj.get()
   // The above will resolve into {hello: 'world'} after checking with s3.getObject
   // and the remembered ETag for changes (and getting 304 not modified).

The constructor parameters are `S3Object({bucket, key}, s3opts)`, where:

- bucket and key specify the object
- s3opts specify any additional options for AWS.S3 constructor such as region
  or access keys.
