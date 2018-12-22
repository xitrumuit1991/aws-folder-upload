# aws-folder-upload

## aws-folder-upload
Allow upload all content of folder include subfolder.

### Import into project
```shell
npm i aws-folder-upload --save
```

### Init config
```javascript
var awsFolderUpload = require('aws-folder-upload');

awsFolderUpload.config({
  accessKeyId: 'accessKeyId', //require string
  secretAccessKey: 'secretAccessKey', //require string
  region: 'region', //optional string aws region
  bucketName:'bucket-name', //require string BucketName only allow lowercase [a-z0-9] and - charactors
  folder:'folder', //require string relative path
  debug:true, //optional boolean
  exclude : ['.scss','.coffee','.zip','.ts'], //optional array
  acl : 'public-read', //optional string. Default is 'public-read'. AWS value "private"|"public-read"|"public-read-write"|"authenticated-read"|"aws-exec-read"|"bucket-owner-read"|"bucket-owner-full-control"
});
```

### Upload
```javascript
awsFolderUpload.upload((err, result)=>{
  if(err)
    console.log('err', err);
  else
    console.log('result', result);
});
```