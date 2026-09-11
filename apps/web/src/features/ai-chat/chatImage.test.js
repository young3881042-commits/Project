import test from 'node:test';
import assert from 'node:assert/strict';
import {photo} from './chatPhotoFixture.test-data.js';
import {validateAttachments,attachmentMarkdown} from './chatAttachments.js';
import {validateChatImage,MAX_PHOTO_BYTES} from './chatImageRules.js';
test('photos validate actual JPEG dimensions, preserve preview and keep binary out of Markdown',()=>{
 const value=validateAttachments([photo])[0];assert.equal(value.width,2);assert.equal(value.height,2);assert.equal(value.kind,'image');assert.equal(value.dataUrl,photo.dataUrl);
 assert.doesNotMatch(attachmentMarkdown([value]),/base64/);assert.match(attachmentMarkdown([value]),/사진 첨부/);
});
test('bad signatures, excessive source size and disguised non-image attachments are rejected',()=>{
 assert.throws(()=>validateChatImage({...photo,dataUrl:'data:image/jpeg;base64,YWJj'}));
 assert.throws(()=>validateChatImage({...photo,size:MAX_PHOTO_BYTES+1}));
 assert.throws(()=>validateAttachments([{name:'a.png',text:'not a photo',size:2,truncated:false}]));
});
