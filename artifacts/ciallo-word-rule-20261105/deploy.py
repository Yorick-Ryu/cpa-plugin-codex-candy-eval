"""Hot replace only the candy plugin, preserving original history and runtimes."""
import datetime,fcntl,hashlib,json,os,pathlib,re,shutil,subprocess,sys,time,urllib.request
os.umask(0o077)
assert os.environ['SSH_CONNECTION'].split()[2]=='45.149.172.143'
stage=pathlib.Path(__file__).resolve().parent
m=json.loads((stage/'manifest.json').read_text())
root=pathlib.Path('/opt/stacks/cpa');plugin='omcpa-codex-candy-eval';version='0.4.5-omc.2';base='/v0/management/plugins/'+plugin
key=(root/'.management-key').read_text().strip()
lock=pathlib.Path('/opt/cpa-account-ops/.plugin-upgrade.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def api(p,method='GET',body=None,etag=None,raw=False):
 h={'Authorization':'Bearer '+key,'Content-Type':'application/json'}
 if etag:h['If-Match']=etag
 req=urllib.request.Request('http://127.0.0.1:8317'+p,method=method,headers=h,data=None if body is None else json.dumps(body).encode())
 with urllib.request.urlopen(req,timeout=40) as r:
  b=r.read();return (b if raw else json.loads(b)),r.headers.get('ETag')
def entry():return next(p for p in api('/v0/management/plugins')[0]['plugins'] if p['id']==plugin)
def containers():return subprocess.check_output(['docker','inspect','cli-proxy-api-core','oh-my-cpa','--format','{{.Id}} {{.State.StartedAt}} {{.RestartCount}}'],text=True)
def workers():return {unit:subprocess.check_output(['systemctl','show',unit,'-p','MainPID,ActiveEnterTimestamp'],text=True) for unit in ['cpa-account-ops','cpr-account-ops']}
def idle(s):return not any(a.get('running') for a in s['credentials'])
def ready(v):
 for _ in range(60):
  p=entry()
  if p.get('registered') and p.get('effective_enabled') and p.get('metadata',{}).get('version')==v:return p
  time.sleep(.5)
 raise RuntimeError('plugin_not_ready')
before=entry();assert before['registered'] and before['effective_enabled'] and before['metadata']['version']=='0.4.5-omc.1','unexpected_previous_version'
s=api(base+'/state')[0];assert not s.get('storage_error') and idle(s),'plugin_busy_or_storage_error'
oldlib=root/before['path'];assert sha(oldlib)==m['previous_library_sha256']
source=stage/m['filename'];assert sha(source)==m['sha256']
pinpath='/v8/management/config/plugins/configs/'+plugin+'/store';pin,etag=api(pinpath);assert etag and pin['version']=='0.4.5-omc.1'
backup=root/('ciallo-word-rule-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
shutil.copy2(oldlib,backup/oldlib.name);(backup/'pin.private.json').write_text(json.dumps(pin))
statefile=root/'plugins'/(plugin+'-state.json');shutil.copy2(statefile,backup/'state.private.json');(backup/'api-state.private.json').write_text(json.dumps(s))
statehash=sha(statefile);runtime,worker_runtime=containers(),workers();target=root/'plugins/linux/amd64'/m['filename'];assert not target.exists()
configured=[{k:a[k] for k in ['id','provider','name','base_url','provider_name','priority','disabled'] if k in a} for a in s['credentials'] if a.get('source')=='ai_providers']
assert idle(api(base+'/state')[0]),'plugin_became_busy'
shutil.copy2(source,target);assert sha(target)==m['sha256']
changed=False
try:
 current,etag=api(pinpath);assert current==pin,'concurrent_pin_change'
 changed=True;api(pinpath,'PUT',pin|{'version':version,'release-tag':'v'+version},etag);active=ready(version)
 api(base+'/credentials/sync','POST',{'credentials':configured})
 after=api(base+'/state')[0];assert not after.get('storage_error')
 # Read-only grading must not rewrite the persisted records during replacement.
 assert sha(statefile)==statehash,'history_file_changed_during_replacement'
 prior={a['id']:a for a in s['credentials']};now={a['id']:a for a in after['credentials']};assert prior.keys()==now.keys(),'credential_scope_changed'
 regraded=0
 for id,a in prior.items():
  b=now[id]
  for field in ['fingerprints','pelicans']:assert b[field]==a[field],'unrelated_history_changed'
  assert len(a['candies'])==len(b['candies'])
  for old,new in zip(a['candies'],b['candies']):
   if old.get('method')!='ciallo' or old.get('error') or old['status'] not in ('correct','wrong','inconclusive'):
    assert old==new,'non_ciallo_or_error_record_changed';continue
   assert {k:v for k,v in old.items() if k not in ('status','verdict','verdict_rule')}=={k:v for k,v in new.items() if k not in ('status','verdict','verdict_rule')},'original_reply_changed'
   words=set(re.findall(r'\w+',old.get('answer','').lower()));greetings=words&{'ciallo','ciao'}
   expected='pass' if greetings=={'ciallo'} else 'fail' if greetings=={'ciao'} else 'inconclusive'
   assert new['verdict']==expected and new['verdict_rule']=='ciallo-word-v1'
   assert new['status']=={'pass':'correct','fail':'wrong','inconclusive':'inconclusive'}[expected]
   if new.get('verdict')!=old.get('verdict') or new.get('status')!=old.get('status'):regraded+=1
 ui=api('/v0/resource/plugins/'+plugin+'/ui',raw=True)[0];assert version.encode() in ui
 assert containers()==runtime and workers()==worker_runtime,'runtime_changed'
 receipt=m|{'version':version,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'backup':str(backup),'hot_replaced':True,'containers_unchanged':True,'workers_unchanged':True,'history_file_unchanged':True,'historical_verdicts_corrected':regraded}
 for path in [stage/'deployment.json',root/'ciallo-word-rule-deployment.json']:path.write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt))
except Exception:
 if changed:
  current,etag=api(pinpath);assert current.get('version')==version,'concurrent_pin_blocks_rollback'
  api(pinpath,'PUT',pin,etag);ready(pin['version'])
 raise
