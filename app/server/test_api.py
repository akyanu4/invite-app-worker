# Server checks. Start the local server first (see README section 5, ADMIN_PASSWORD=admin123 WORKER_SECRET=worker-secret),
# then: python server/test_api.py   (uses a fresh PGLITE_DIR, since it registers fixed phone numbers)
import json, urllib.request
B='http://localhost:8787/api'
def call(method, path, data=None, token=None, raw=False):
    req=urllib.request.Request(B+path, method=method, data=json.dumps(data).encode() if data is not None else None, headers={'content-type':'application/json', **({'authorization':'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: b=r.read(); return r.status, (b if raw else json.loads(b))
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())
ok=lambda c,msg: print(('PASS ' if c else 'FAIL ')+msg)
s,r=call('GET','/config'); ok(s==200 and r['prices']=={'customer':200,'shop':50}, f'config {r}')
s,r=call('POST','/auth/signup',{'phone':'98765 43210','password':'secret1','name':'Imran','shop_name':'Imran Prints','city':'Hyderabad'}); shop=r.get('token'); ok(s==200 and r['user']['status']=='pending','shop signup pending')
s,r=call('POST','/auth/signup',{'phone':'9876543210','password':'secret1','name':'X','shop_name':'Y'}); ok(s==409,'duplicate phone rejected')
s,r=call('POST','/auth/login',{'phone':'9876543210','password':'wrong'}); ok(s==401,'wrong password rejected')
s,r=call('POST','/orders',{'device_id':'dev1','category':'marriage','template':'rose_gold','fields':{'groom_short':'Ayaan'},'events':[]},token=shop); ok(r['order']['price']==200,'pending shop pays 200')
s,r=call('POST','/admin/login',{'password':'nope'}); ok(s==401,'bad admin password')
s,r=call('POST','/admin/login',{'password':'admin123'}); adm=r['token']; ok(s==200,'admin login')
s,r=call('GET','/admin/summary',token=adm); uid=r['shops'][0]['id']; ok(r['shops'][0]['status']=='pending','admin sees pending shop')
s,r=call('POST',f'/admin/shops/{uid}',{'approve':True},token=adm); ok(s==200,'approve shop')
s,r=call('POST','/orders',{'device_id':'dev1','category':'marriage','template':'rose_gold','fields':{'groom_short':'Ayaan'},'events':[]},token=shop); shop_order=r['order']['id']; ok(r['order']['price']==50,'approved shop pays 50')
s,r=call('POST','/orders',{'device_id':'dev2','category':'birthday','template':'confetti','fields':{'name':'Zara'},'events':[]}); cust=r['order']['id']; ok(r['order']['price']==200 and r['order']['final_url'] is None,'customer pays 200')
s,r=call('POST','/worker/next',{} ,token='wrong'); ok(s==401,'worker auth required')
jobs=[]
for _ in range(4):
    s,r=call('POST','/worker/next',{},token='worker-secret'); jobs.append(r['job'] and r['job']['id'])
ok(jobs[:3]==[jobs[0],jobs[1],cust] and jobs[3] is None, f'worker gets queued jobs in order, then none {jobs}')
s,r=call('POST','/worker/complete',{'id':cust,'preview_url':'https://res.cloudinary.com/x/prev.mp4','final_url':'https://res.cloudinary.com/x/final.mp4'},token='worker-secret'); ok(s==200,'worker complete')
s,r=call('GET',f'/orders/{cust}'); ok(r['order']['status']=='ready' and r['order']['final_url'] is None and r['order']['preview_url'],'ready, final hidden before payment')
s,r=call('POST',f'/orders/{cust}/utr',{'utr':'12'}); ok(s==400,'bad UTR rejected')
s,r=call('POST',f'/orders/{cust}/utr',{'utr':'432112345678'}); ok(r['order']['pay_status']=='submitted','UTR submitted')
s,r=call('POST',f'/orders/{shop_order}/utr',{'utr':'432112345678'}); ok(s==409,'same UTR cannot be reused')
s,r=call('GET','/admin/summary',token=adm); ok(any(p['id']==cust for p in r['payments']),'admin sees payment to verify')
s,r=call('POST',f'/admin/payments/{cust}',{'approve':True},token=adm)
s,r=call('GET',f'/orders/{cust}'); ok(r['order']['pay_status']=='paid' and r['order']['final_url'].endswith('final.mp4'),'paid -> final link visible')
s,r=call('POST','/admin/promos',{'code':'family2026','max_uses':1,'note':'test'},token=adm); ok(s==200,'create promo')
s,r=call('POST',f'/orders/{shop_order}/promo',{'code':'WRONG'}); ok(s==400,'invalid promo rejected')
s,r=call('POST',f'/orders/{shop_order}/promo',{'code':'family2026'}); ok(r['order']['price']==0 and r['order']['pay_status']=='paid','promo makes it free and paid')
s,r=call('POST','/orders',{'device_id':'dev3','category':'marriage','template':'rose_gold','fields':{'groom_short':'B'}}); o3=r['order']['id']
s,r=call('POST',f'/orders/{o3}/promo',{'code':'FAMILY2026'}); ok(s==400,'one-use promo cannot be reused')
s,r=call('GET',f'/orders/{o3}/qr',raw=True); ok(s==200 and r[:4]==b'\x89PNG','UPI QR png')
s,r=call('POST','/upload/sign',{}); ok(len(r['signature'])==40 and r['public_id'].startswith('invites/cards/'),'signed upload params')
s,r=call('POST','/worker/catalog',{'categories':[{'id':'marriage'}],'templates':[{'id':'rose_gold'}]},token='worker-secret')
s,r=call('GET','/catalog'); ok(r['templates'][0]['id']=='rose_gold','catalog stored and served')
