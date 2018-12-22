let AWS = require('aws-sdk');
let path = require("path");
let fs = require('fs');
let mime = require('mime');
let _ = require('lodash');
let self, awsFolderUpload;
self = awsFolderUpload = {
  accessKeyId:'',
  secretAccessKey:'',
  region:'ap-southeast-1',
  bucketName:'',
  debug:true,
  folder:'',
  exclude:[],
  acl:'public-read', // "private"|"public-read"|"public-read-write"|"authenticated-read"|"aws-exec-read"|"bucket-owner-read"|"bucket-owner-full-control"|string;
  error:false,
};
awsFolderUpload.initS3 = ()=>{
    return new AWS.S3({
      accessKeyId: self.accessKeyId,
      secretAccessKey: self.secretAccessKey,
      region: self.region,
    });
  };

awsFolderUpload.logger = (msg,data)=>{
    if(self.debug){
      if(msg && data) return console.log(msg, data);
      if(msg) return console.log(msg);
    }
  };

awsFolderUpload.config = (configs)=>{
    self.accessKeyId = configs.accessKeyId;
    self.secretAccessKey = configs.secretAccessKey;
    if(configs.region) self.region = configs.region;
    self.bucketName = configs.bucketName;
    self.debug = !!configs.debug;
    self.folder = configs.folder;
    if(!self.accessKeyId || !self.secretAccessKey || !self.folder || !self.bucketName){
      self.error = true;
      return console.error(`Missing accessKeyId or secretAccessKey or folder or bucketName`);
    }
    let regrex = new RegExp(/^[a-z0-9\-]*$/);
    if(regrex.test(self.bucketName)===false){
      self.error = true;
      return console.error(`Bucket '${self.bucketName}' only allow lowercase [a-z0-9] and - charactors`);
    }
    let isDirectory = false;
    try{
      isDirectory = fs.lstatSync(self.folder).isDirectory();
      if(isDirectory === false){
        self.error = true;
        return console.error(`ERROR '${self.folder}' is not a directory`);
      }
    }catch(e){
      self.error = true;
      console.error(e);
      return console.error(`ERROR '${self.folder}' is not a directory`);
    }
    if(configs.acl) self.acl = configs.acl;
    if(configs.exclude && _.isArray(configs.exclude) && !_.isEmpty(configs.exclude)) self.exclude = configs.exclude;
    self.logger('configs', configs);
  };

awsFolderUpload.replaceCharacter = (text)=>{
    if(!text || typeof text !== 'string') return '';
    text = text ? text.trim() : ""; //trim spaces start and end
    if(!text) return '';
    return text.toString()
      // .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\_\-\/\.]+/g, '')       // Remove all non-word chars
      // .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      // .replace(/^-+/, '')             // Trim - from start of text
      // .replace(/-+$/, '');            // Trim - from end of text
  };

awsFolderUpload.checkAndCreateBucket = (done)=>{
    if(self.error) return console.error(`Init config aws-folder-upload has error`);
    if(typeof done === 'undefined' || done === undefined || done === null)
      done = function(){};
    let params = {
      Bucket: self.bucketName,
    };
    let s3 = self.initS3();
    s3.headBucket(params,(err, result)=>{
      if (err) {
        if (err && err.statusCode === 404) {
          self.logger(`${self.bucketName} bucket is empty`, err);
          s3.createBucket(params, (errCreated, resCreated)=>{
            if(errCreated){
              console.error(errCreated);
              self.logger(`ERROR when create Bucket ${self.bucketName}`, errCreated);
              return done(errCreated);
            }
            self.logger(`SUCCESS bucket created ${self.bucketName}`, result);
            return done(null);
          });
          return
        }
        console.error(err);
        self.logger(`ERROR when check bucket ${self.bucketName}`, err);
        return done(err)
      } else {
        self.logger(`Bucket has already exist`, result);
        done(null);
      }
    });
  };

awsFolderUpload.loopAndUpload = ()=>{
    if(self.error) return console.error(`Init config aws-folder-upload has error`);
    if(!fs.statSync(self.folder).isDirectory()){
      return console.error(`${self.folder} is not directory`);
    }
    let deepLoopDir = (currentDirPath, callback)=>{
      if(typeof callback !== 'function'){
        return console.error(`callback is not a function`);
      }
      fs.readdirSync(currentDirPath).forEach( (name)=>{
        // console.log('currentDirPath', currentDirPath);
        // console.log('name', name);
        let filePath = path.join(currentDirPath, name);
        let fileContent = fs.statSync(filePath);
        if (fileContent.isFile()) {
          callback(filePath, fileContent);
        } else if (fileContent.isDirectory()){
          deepLoopDir(filePath, callback);
        }
      });
    };

    deepLoopDir(self.folder, (filePath, stat)=>{
      if(self.exclude && self.exclude[0] ){
        // console.log('self.exclude',self.exclude);
        let str = `^[a-zA-Z0-9\\_\\-\\.\\/]*(${self.exclude.join('|')})$`;
        let regex = new RegExp(str);
        // console.log('regrex str', str);
        // console.log('filePath', filePath);
        // console.log('regex.test(filePath)', regex.test(filePath));
        if(regex.test(filePath) === true)
          return;
      }
      let key = filePath.substring(0, filePath.length);
      key = self.replaceCharacter(key);
      // console.log('filePath=', filePath);
      // console.log('key object=', key);
      let params = {
        Bucket: self.bucketName,
        Key : key,
        Body: fs.readFileSync(filePath),
        ACL : self.acl || 'public-read',
        ContentType: mime.getType(filePath),
      };
      if(key){
        let s3 = self.initS3();
        s3.putObject(params, (err, data)=>{
          if (err) {
            console.error(err);
            self.logger(`ERROR putObject to s3`, err);
          } else {
            self.logger('Successfully uploaded '+ key +' to ' + self.bucketName);
            return
          }
        });
      }
    });
  };

awsFolderUpload.upload = (cb = null)=>{
    if(self.error) return console.error(`Init config aws-folder-upload has error`);
    let isDirectory=false;
    try{
      isDirectory = fs.lstatSync(self.folder).isDirectory();
    }catch(e){
      isDirectory = false;
      console.error(e);
      return console.error(`ERROR '${self.folder}' is not a directory`);
    }
    if(isDirectory)
    {
      self.checkAndCreateBucket((err)=>{
        if(err){
          console.error(`ERROR check ${self.bucketName}`,err);
          if(typeof cb === 'function')
            return cb(err, null);
          return
        }
        self.loopAndUpload();
        return cb(null,{message: `Success upload to ${self.bucketName}`});
      });
    }else{
      console.error(`ERROR ${self.folder} is NOT Directory`);
      if(typeof cb === 'function')
        return cb(`ERROR ${self.folder} is NOT Directory`, null);
    }
};

module.exports = awsFolderUpload;