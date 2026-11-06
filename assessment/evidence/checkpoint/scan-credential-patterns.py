import subprocess,re,json
patterns={
'google_api_key':r'AIza[0-9A-Za-z_-]{35}',
'aws_access_key':r'(?:AKIA|ASIA)[0-9A-Z]{16}',
'github_token':r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
'openai_token':r'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}',
'private_key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
'slack_token':r'xox[baprs]-[0-9A-Za-z-]{20,}'
}
files=subprocess.check_output(['git','ls-files','-z']).split(b'\0')
hits=[]
for raw in files:
 if not raw: continue
 path=raw.decode()
 try: data=open(path,'rb').read().decode('utf-8')
 except (UnicodeError,OSError): continue
 for kind,pattern in patterns.items():
  for m in re.finditer(pattern,data):hits.append({'path':path,'line':data[:m.start()].count('\n')+1,'kind':kind})
objects=subprocess.check_output(['git','rev-list','--objects','--all']).decode().splitlines()
blobs=0;history_hits=[]
for item in objects:
 oid,_,path=item.partition(' ')
 if subprocess.check_output(['git','cat-file','-t',oid]).strip()!=b'blob':continue
 blobs+=1
 data=subprocess.check_output(['git','cat-file','blob',oid])
 try:data=data.decode('utf-8')
 except UnicodeError:continue
 for kind,pattern in patterns.items():
  if re.search(pattern,data):history_hits.append({'object':oid,'path':path,'kind':kind})
print(json.dumps({'tracked_files':len(files)-1,'history_blobs_all_refs':blobs,'current_hits_redacted':hits,'history_hits_redacted':history_hits,'scope':'Six credential patterns, all tracked files + reachable history including backup tags. No entropy/PII scan; not proof of absence.'},indent=2))
