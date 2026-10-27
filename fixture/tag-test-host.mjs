import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir='/tmp/cindy-6947-tools.JnysMa/evidence';
const { runTaskTagsTransaction }=await import(pathToFileURL(resolve('apps/desktop/src/main/localDb/worker/opHandlers/taskTagsTx.ts')));
const sql=new DatabaseSync(dir+'/task-tags-qa.sqlite');
sql.exec("PRAGMA foreign_keys=ON; CREATE TABLE sessions(id TEXT PRIMARY KEY,status TEXT DEFAULT 'active',source TEXT DEFAULT 'desktop',updated_at INTEGER DEFAULT 1); CREATE TABLE bot_session_links(session_id TEXT); INSERT INTO sessions(id) VALUES('session-primary');");
for(const migration of ['0110_abandoned_scarlet_witch.sql','0111_messy_newton_destine.sql','0112_backfill_task_tag_order.sql','0113_grey_cannonball.sql'])sql.exec(readFileSync(resolve('apps/desktop/drizzle',migration),'utf8'));
const db={prepare:(...args)=>sql.prepare(...args),transaction:(fn)=>(...args)=>{sql.exec('BEGIN');try{const result=fn(...args);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const run=request=>runTaskTagsTransaction(db,request);
for(const tag of run({action:'list'}).tags){const d=run({action:'previewDelete',tagId:tag.id}).deletion;run({action:'delete',tagId:tag.id,revision:d.revision,expectedCount:d.count});}
for(const [id,name,color] of [['qa-work','工作','blue'],['qa-follow','待跟进','pink'],['qa-ideas','灵感','yellow']])run({action:'create',newId:id,name,color});
run({action:'attach',sessionIds:['session-primary'],tagIds:['qa-work','qa-follow']});
const server=createServer(async(req,res)=>{res.setHeader('content-type','application/json');res.setHeader('access-control-allow-origin','*');if(req.method==='GET'){res.end(JSON.stringify(run({action:'list'})));return;}try{let body='';for await(const data of req)body+=data;let input=JSON.parse(body);if(input.action==='create')input.newId=randomUUID();const result=run(input);appendFileSync(dir+'/host-operations.jsonl',JSON.stringify({time:new Date().toISOString(),input,result})+'\n');res.end(JSON.stringify(result));}catch(e){res.statusCode=409;res.end(JSON.stringify({error:e.message}));}});
server.listen(0,'127.0.0.1',()=>{const port=server.address().port;writeFileSync(dir+'/host-port',String(port));console.log('TAG_QA_HOST_PORT='+port);});
