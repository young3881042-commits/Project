import test from 'node:test';
import assert from 'node:assert/strict';
import { MERCHANT_CATALOG, matchMerchantCatalog } from './merchantCatalog.js';
import { financeCategoryForMerchant, addFinanceCategory } from './financeCategories.js';
import { recategorizeImportedCardEntries } from './cardTransactionImport.js';

test('verified brand aliases classify offline, including branch and payment-prefix forms',()=>{
 for(const [name,category] of [['스타벅스 강남점','커피'],['메가MGC커피 서울역점','커피'],['(주)이디야커피','커피'],['카카오페이_파리바게뜨 종로점','식비'],['CU역삼점','쇼핑'],['ＧＳ２５ 강남점','쇼핑'],['SRT','교통'],['유니클로 명동점','쇼핑']]) assert.equal(financeCategoryForMerchant(name),category,name);
});
test('short-name collisions, opaque payment processors and sensitive identifiers are not guessed',()=>{
 for(const name of ['CUCUMBER','SRTTECH','카카오페이','네이버페이','토스','스타벅스 1234-5678-9012','유니클로 계좌','스타벅스교육원','서울맥도날드물류회사']) assert.equal(matchMerchantCatalog(name),null,name);
});
test('every alias has one verified source and an unambiguous catalog match',()=>{
 for(const row of MERCHANT_CATALOG){assert.match(row.source,/^https:\/\//);for(const alias of row.aliases)assert.equal(matchMerchantCatalog(alias)?.name,row.name,alias);}
});
test('user keyword and historical categories survive catalog enrichment',()=>{
 const settings=addFinanceCategory(null,{category:'업무',keywords:'스타벅스'}).settings;
 assert.equal(financeCategoryForMerchant('스타벅스 강남점',settings),'업무');
 const rows=[{id:'a',type:'withdraw',memo:'스타벅스 강남점',category:'접대',date:'2026-09-01'}, {id:'b',type:'withdraw',memo:'스타벅스 강남점',category:'기타',source:'card-notification',origin:{kind:'card-notification'},date:'2026-09-17'}, {id:'c',memo:'이디야 역삼점',category:'개인 지정',source:'card-notification',origin:{kind:'card-notification'}}];
 const updated=recategorizeImportedCardEntries(rows,settings);assert.equal(updated.items[1].category,'접대');assert.equal(updated.items[2].category,'개인 지정');
});
