# Keno 10 aus 40: Auszahlungstabellen auf ca. 95 % abstimmen
from math import comb
def p(n,k): return comb(n,k)*comb(40-n,10-k)/comb(40,10)
T = {
 1:{1:3.8},
 2:{1:1,2:9},
 3:{2:2.5,3:25},
 4:{2:1.5,3:6,4:60},
 5:{2:1,3:3,4:18,5:150},
 6:{3:2,4:6,5:50,6:400},
 7:{3:1.5,4:4,5:15,6:120,7:1000},
 8:{3:1,4:3,5:10,6:50,7:400,8:2000},
 9:{4:2,5:6,6:25,7:120,8:800,9:4000},
 10:{0:2,4:1,5:3,6:14,7:60,8:400,9:2000,10:10000},
}
for n,t in T.items():
    e=sum(p(n,k)*m for k,m in t.items()); hit=sum(p(n,k) for k in t)
    print(n, f"RTP {e*100:.1f}%  Trefferchance {hit*100:.0f}%")

def nice(v):
    if v < 10: return round(v*2)/2
    if v < 100: return round(v)
    if v < 1000: return round(v/5)*5
    return round(v/50)*50
print('--- skaliert ---')
out={}
for n,t in T.items():
    e=sum(p(n,k)*m for k,m in t.items())
    f=0.95/e
    for _ in range(30):
        s={k:nice(m*f) for k,m in t.items()}
        e2=sum(p(n,k)*m for k,m in s.items())
        if abs(e2-0.95)<0.006: break
        f*=0.95/e2
    out[n]=s
    print(n, s, f"{e2*100:.1f}%")
import json; print(json.dumps({str(k):{str(a):b for a,b in v.items()} for k,v in out.items()}))
