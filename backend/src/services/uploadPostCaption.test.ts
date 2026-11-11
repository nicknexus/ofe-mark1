// node -r sucrase/register --test backend/src/services/uploadPostCaption.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { photoCaptionFields, socialCaption, textCaptionFields } from './uploadPostCaption'

test('caption joins headline, body, and call to action', () => {
    assert.equal(socialCaption(['Holding scissors', 'A first lesson.', 'Learn more.']), 'Holding scissors\n\nA first lesson.\n\nLearn more.')
    assert.equal(socialCaption(['  Headline  ', '', null, 'Body']), 'Headline\n\nBody')
})

test('instagram photos send the caption as the title, not only a side field', () => {
    const fields = photoCaptionFields('instagram', 'Holding scissors\n\nA first lesson.')
    assert.equal(fields.title, 'Holding scissors\n\nA first lesson.')
    assert.equal(fields.instagram_title, fields.title)
    assert.equal(fields.description, fields.title)
    assert.equal(photoCaptionFields('facebook', 'Hello').facebook_title, 'Hello')
    assert.equal(photoCaptionFields('facebook', 'Hello').description, undefined)
    assert.equal(photoCaptionFields('linkedin', 'Hook\n\nBody').linkedin_description, 'Hook\n\nBody')
    assert.equal(photoCaptionFields('linkedin', 'Hook\n\nBody').linkedin_title, 'Hook')
})

test('text posts do not repeat the facebook caption as a title', () => {
    const fields = textCaptionFields('facebook', 'Hello there')
    assert.equal(fields.facebook_description, 'Hello there')
    assert.equal(fields.facebook_title, undefined)
})
