var rc=Object.create;var Fs=Object.defineProperty;var sc=Object.getOwnPropertyDescriptor;var oc=Object.getOwnPropertyNames;var ac=Object.getPrototypeOf,lc=Object.prototype.hasOwnProperty;var st=(i,t)=>()=>{try{return t||i((t={exports:{}}).exports,t),t.exports}catch(e){throw t=0,e}};var cc=(i,t,e,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of oc(t))!lc.call(i,o)&&o!==e&&Fs(i,o,{get:()=>t[o],enumerable:!(r=sc(t,o))||r.enumerable});return i};var Kn=(i,t,e)=>(e=i!=null?rc(ac(i)):{},cc(t||!i||!i.__esModule?Fs(e,"default",{value:i,enumerable:!0}):e,i));var Wi=st((Ry,Xi)=>{(function(){"use strict";var i={};i.version="6.4.2.2",i.use_lines=!0,i.use_xyz=!1;var t=!1;typeof Xi<"u"&&Xi.exports?(Xi.exports=i,t=!0):(typeof define=="function"&&define.amd&&define(i),typeof document<"u"?window.ClipperLib=i:self.ClipperLib=i);var e;if(t){var r="chrome";e="Netscape"}else{var r=navigator.userAgent.toString().toLowerCase();e=navigator.appName}var o={};r.indexOf("chrome")!=-1&&r.indexOf("chromium")==-1?o.chrome=1:o.chrome=0,r.indexOf("chromium")!=-1?o.chromium=1:o.chromium=0,r.indexOf("safari")!=-1&&r.indexOf("chrome")==-1&&r.indexOf("chromium")==-1?o.safari=1:o.safari=0,r.indexOf("firefox")!=-1?o.firefox=1:o.firefox=0,r.indexOf("firefox/17")!=-1?o.firefox17=1:o.firefox17=0,r.indexOf("firefox/15")!=-1?o.firefox15=1:o.firefox15=0,r.indexOf("firefox/3")!=-1?o.firefox3=1:o.firefox3=0,r.indexOf("opera")!=-1?o.opera=1:o.opera=0,r.indexOf("msie 10")!=-1?o.msie10=1:o.msie10=0,r.indexOf("msie 9")!=-1?o.msie9=1:o.msie9=0,r.indexOf("msie 8")!=-1?o.msie8=1:o.msie8=0,r.indexOf("msie 7")!=-1?o.msie7=1:o.msie7=0,r.indexOf("msie ")!=-1?o.msie=1:o.msie=0,i.biginteger_used=null;var l,c=0xdeadbeefcafe,f=(c&16777215)==15715070;function h(n,s,a){i.biginteger_used=1,n!=null&&(typeof n=="number"&&typeof s>"u"?this.fromInt(n):typeof n=="number"?this.fromNumber(n,s,a):s==null&&typeof n!="string"?this.fromString(n,256):this.fromString(n,s))}function p(){return new h(null,void 0,void 0)}function m(n,s,a,u,d,g){for(;--g>=0;){var y=s*this[n++]+a[u]+d;d=Math.floor(y/67108864),a[u++]=y&67108863}return d}function x(n,s,a,u,d,g){for(var y=s&32767,M=s>>15;--g>=0;){var b=this[n]&32767,A=this[n++]>>15,L=M*b+A*y;b=y*b+((L&32767)<<15)+a[u]+(d&1073741823),d=(b>>>30)+(L>>>15)+M*A+(d>>>30),a[u++]=b&1073741823}return d}function _(n,s,a,u,d,g){for(var y=s&16383,M=s>>14;--g>=0;){var b=this[n]&16383,A=this[n++]>>14,L=M*b+A*y;b=y*b+((L&16383)<<14)+a[u]+d,d=(b>>28)+(L>>14)+M*A,a[u++]=b&268435455}return d}f&&e=="Microsoft Internet Explorer"?(h.prototype.am=x,l=30):f&&e!="Netscape"?(h.prototype.am=m,l=26):(h.prototype.am=_,l=28),h.prototype.DB=l,h.prototype.DM=(1<<l)-1,h.prototype.DV=1<<l;var v=52;h.prototype.FV=Math.pow(2,v),h.prototype.F1=v-l,h.prototype.F2=2*l-v;var S="0123456789abcdefghijklmnopqrstuvwxyz",E=new Array,w,P;for(w=48,P=0;P<=9;++P)E[w++]=P;for(w=97,P=10;P<36;++P)E[w++]=P;for(w=65,P=10;P<36;++P)E[w++]=P;function N(n){return S.charAt(n)}function C(n,s){var a=E[n.charCodeAt(s)];return a??-1}function I(n){for(var s=this.t-1;s>=0;--s)n[s]=this[s];n.t=this.t,n.s=this.s}function D(n){this.t=1,this.s=n<0?-1:0,n>0?this[0]=n:n<-1?this[0]=n+this.DV:this.t=0}function B(n){var s=p();return s.fromInt(n),s}function z(n,s){var a;if(s==16)a=4;else if(s==8)a=3;else if(s==256)a=8;else if(s==2)a=1;else if(s==32)a=5;else if(s==4)a=2;else{this.fromRadix(n,s);return}this.t=0,this.s=0;for(var u=n.length,d=!1,g=0;--u>=0;){var y=a==8?n[u]&255:C(n,u);if(y<0){n.charAt(u)=="-"&&(d=!0);continue}d=!1,g==0?this[this.t++]=y:g+a>this.DB?(this[this.t-1]|=(y&(1<<this.DB-g)-1)<<g,this[this.t++]=y>>this.DB-g):this[this.t-1]|=y<<g,g+=a,g>=this.DB&&(g-=this.DB)}a==8&&(n[0]&128)!=0&&(this.s=-1,g>0&&(this[this.t-1]|=(1<<this.DB-g)-1<<g)),this.clamp(),d&&h.ZERO.subTo(this,this)}function O(){for(var n=this.s&this.DM;this.t>0&&this[this.t-1]==n;)--this.t}function X(n){if(this.s<0)return"-"+this.negate().toString(n);var s;if(n==16)s=4;else if(n==8)s=3;else if(n==2)s=1;else if(n==32)s=5;else if(n==4)s=2;else return this.toRadix(n);var a=(1<<s)-1,u,d=!1,g="",y=this.t,M=this.DB-y*this.DB%s;if(y-- >0)for(M<this.DB&&(u=this[y]>>M)>0&&(d=!0,g=N(u));y>=0;)M<s?(u=(this[y]&(1<<M)-1)<<s-M,u|=this[--y]>>(M+=this.DB-s)):(u=this[y]>>(M-=s)&a,M<=0&&(M+=this.DB,--y)),u>0&&(d=!0),d&&(g+=N(u));return d?g:"0"}function k(){var n=p();return h.ZERO.subTo(this,n),n}function H(){return this.s<0?this.negate():this}function Q(n){var s=this.s-n.s;if(s!=0)return s;var a=this.t;if(s=a-n.t,s!=0)return this.s<0?-s:s;for(;--a>=0;)if((s=this[a]-n[a])!=0)return s;return 0}function W(n){var s=1,a;return(a=n>>>16)!=0&&(n=a,s+=16),(a=n>>8)!=0&&(n=a,s+=8),(a=n>>4)!=0&&(n=a,s+=4),(a=n>>2)!=0&&(n=a,s+=2),(a=n>>1)!=0&&(n=a,s+=1),s}function tt(){return this.t<=0?0:this.DB*(this.t-1)+W(this[this.t-1]^this.s&this.DM)}function Y(n,s){var a;for(a=this.t-1;a>=0;--a)s[a+n]=this[a];for(a=n-1;a>=0;--a)s[a]=0;s.t=this.t+n,s.s=this.s}function pt(n,s){for(var a=n;a<this.t;++a)s[a-n]=this[a];s.t=Math.max(this.t-n,0),s.s=this.s}function xt(n,s){var a=n%this.DB,u=this.DB-a,d=(1<<u)-1,g=Math.floor(n/this.DB),y=this.s<<a&this.DM,M;for(M=this.t-1;M>=0;--M)s[M+g+1]=this[M]>>u|y,y=(this[M]&d)<<a;for(M=g-1;M>=0;--M)s[M]=0;s[g]=y,s.t=this.t+g+1,s.s=this.s,s.clamp()}function wt(n,s){s.s=this.s;var a=Math.floor(n/this.DB);if(a>=this.t){s.t=0;return}var u=n%this.DB,d=this.DB-u,g=(1<<u)-1;s[0]=this[a]>>u;for(var y=a+1;y<this.t;++y)s[y-a-1]|=(this[y]&g)<<d,s[y-a]=this[y]>>u;u>0&&(s[this.t-a-1]|=(this.s&g)<<d),s.t=this.t-a,s.clamp()}function kt(n,s){for(var a=0,u=0,d=Math.min(n.t,this.t);a<d;)u+=this[a]-n[a],s[a++]=u&this.DM,u>>=this.DB;if(n.t<this.t){for(u-=n.s;a<this.t;)u+=this[a],s[a++]=u&this.DM,u>>=this.DB;u+=this.s}else{for(u+=this.s;a<n.t;)u-=n[a],s[a++]=u&this.DM,u>>=this.DB;u-=n.s}s.s=u<0?-1:0,u<-1?s[a++]=this.DV+u:u>0&&(s[a++]=u),s.t=a,s.clamp()}function Vt(n,s){var a=this.abs(),u=n.abs(),d=a.t;for(s.t=d+u.t;--d>=0;)s[d]=0;for(d=0;d<u.t;++d)s[d+a.t]=a.am(0,u[d],s,d,0,a.t);s.s=0,s.clamp(),this.s!=n.s&&h.ZERO.subTo(s,s)}function ne(n){for(var s=this.abs(),a=n.t=2*s.t;--a>=0;)n[a]=0;for(a=0;a<s.t-1;++a){var u=s.am(a,s[a],n,2*a,0,1);(n[a+s.t]+=s.am(a+1,2*s[a],n,2*a+1,u,s.t-a-1))>=s.DV&&(n[a+s.t]-=s.DV,n[a+s.t+1]=1)}n.t>0&&(n[n.t-1]+=s.am(a,s[a],n,2*a,0,1)),n.s=0,n.clamp()}function Wn(n,s,a){var u=n.abs();if(!(u.t<=0)){var d=this.abs();if(d.t<u.t){s?.fromInt(0),a!=null&&this.copyTo(a);return}a==null&&(a=p());var g=p(),y=this.s,M=n.s,b=this.DB-W(u[u.t-1]);b>0?(u.lShiftTo(b,g),d.lShiftTo(b,a)):(u.copyTo(g),d.copyTo(a));var A=g.t,L=g[A-1];if(L!=0){var R=L*(1<<this.F1)+(A>1?g[A-2]>>this.F2:0),F=this.FV/R,G=(1<<this.F1)/R,J=1<<this.F2,K=a.t,nt=K-A,bt=s??p();for(g.dlShiftTo(nt,bt),a.compareTo(bt)>=0&&(a[a.t++]=1,a.subTo(bt,a)),h.ONE.dlShiftTo(A,bt),bt.subTo(g,g);g.t<A;)g[g.t++]=0;for(;--nt>=0;){var Gt=a[--K]==L?this.DM:Math.floor(a[K]*F+(a[K-1]+J)*G);if((a[K]+=g.am(0,Gt,a,nt,0,A))<Gt)for(g.dlShiftTo(nt,bt),a.subTo(bt,a);a[K]<--Gt;)a.subTo(bt,a)}s!=null&&(a.drShiftTo(A,s),y!=M&&h.ZERO.subTo(s,s)),a.t=A,a.clamp(),b>0&&a.rShiftTo(b,a),y<0&&h.ZERO.subTo(a,a)}}}function Yn(n){var s=p();return this.abs().divRemTo(n,null,s),this.s<0&&s.compareTo(h.ZERO)>0&&n.subTo(s,s),s}function Ht(n){this.m=n}function qn(n){return n.s<0||n.compareTo(this.m)>=0?n.mod(this.m):n}function Zn(n){return n}function Jn(n){n.divRemTo(this.m,null,n)}function _e(n,s,a){n.multiplyTo(s,a),this.reduce(a)}function ye(n,s){n.squareTo(s),this.reduce(s)}Ht.prototype.convert=qn,Ht.prototype.revert=Zn,Ht.prototype.reduce=Jn,Ht.prototype.mulTo=_e,Ht.prototype.sqrTo=ye;function ve(){if(this.t<1)return 0;var n=this[0];if((n&1)==0)return 0;var s=n&3;return s=s*(2-(n&15)*s)&15,s=s*(2-(n&255)*s)&255,s=s*(2-((n&65535)*s&65535))&65535,s=s*(2-n*s%this.DV)%this.DV,s>0?this.DV-s:-s}function Ft(n){this.m=n,this.mp=n.invDigit(),this.mpl=this.mp&32767,this.mph=this.mp>>15,this.um=(1<<n.DB-15)-1,this.mt2=2*n.t}function fn(n){var s=p();return n.abs().dlShiftTo(this.m.t,s),s.divRemTo(this.m,null,s),n.s<0&&s.compareTo(h.ZERO)>0&&this.m.subTo(s,s),s}function Va(n){var s=p();return n.copyTo(s),this.reduce(s),s}function Ha(n){for(;n.t<=this.mt2;)n[n.t++]=0;for(var s=0;s<this.m.t;++s){var a=n[s]&32767,u=a*this.mpl+((a*this.mph+(n[s]>>15)*this.mpl&this.um)<<15)&n.DM;for(a=s+this.m.t,n[a]+=this.m.am(0,u,n,s,0,this.m.t);n[a]>=n.DV;)n[a]-=n.DV,n[++a]++}n.clamp(),n.drShiftTo(this.m.t,n),n.compareTo(this.m)>=0&&n.subTo(this.m,n)}function Ga(n,s){n.squareTo(s),this.reduce(s)}function Xa(n,s,a){n.multiplyTo(s,a),this.reduce(a)}Ft.prototype.convert=fn,Ft.prototype.revert=Va,Ft.prototype.reduce=Ha,Ft.prototype.mulTo=Xa,Ft.prototype.sqrTo=Ga;function Wa(){return(this.t>0?this[0]&1:this.s)==0}function Ya(n,s){if(n>4294967295||n<1)return h.ONE;var a=p(),u=p(),d=s.convert(this),g=W(n)-1;for(d.copyTo(a);--g>=0;)if(s.sqrTo(a,u),(n&1<<g)>0)s.mulTo(u,d,a);else{var y=a;a=u,u=y}return s.revert(a)}function qa(n,s){var a;return n<256||s.isEven()?a=new Ht(s):a=new Ft(s),this.exp(n,a)}h.prototype.copyTo=I,h.prototype.fromInt=D,h.prototype.fromString=z,h.prototype.clamp=O,h.prototype.dlShiftTo=Y,h.prototype.drShiftTo=pt,h.prototype.lShiftTo=xt,h.prototype.rShiftTo=wt,h.prototype.subTo=kt,h.prototype.multiplyTo=Vt,h.prototype.squareTo=ne,h.prototype.divRemTo=Wn,h.prototype.invDigit=ve,h.prototype.isEven=Wa,h.prototype.exp=Ya,h.prototype.toString=X,h.prototype.negate=k,h.prototype.abs=H,h.prototype.compareTo=Q,h.prototype.bitLength=tt,h.prototype.mod=Yn,h.prototype.modPowInt=qa,h.ZERO=B(0),h.ONE=B(1);function Za(){var n=p();return this.copyTo(n),n}function Ja(){if(this.s<0){if(this.t==1)return this[0]-this.DV;if(this.t==0)return-1}else{if(this.t==1)return this[0];if(this.t==0)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]}function Ka(){return this.t==0?this.s:this[0]<<24>>24}function $a(){return this.t==0?this.s:this[0]<<16>>16}function ja(n){return Math.floor(Math.LN2*this.DB/Math.log(n))}function Qa(){return this.s<0?-1:this.t<=0||this.t==1&&this[0]<=0?0:1}function tl(n){if(n==null&&(n=10),this.signum()==0||n<2||n>36)return"0";var s=this.chunkSize(n),a=Math.pow(n,s),u=B(a),d=p(),g=p(),y="";for(this.divRemTo(u,d,g);d.signum()>0;)y=(a+g.intValue()).toString(n).substr(1)+y,d.divRemTo(u,d,g);return g.intValue().toString(n)+y}function el(n,s){this.fromInt(0),s==null&&(s=10);for(var a=this.chunkSize(s),u=Math.pow(s,a),d=!1,g=0,y=0,M=0;M<n.length;++M){var b=C(n,M);if(b<0){n.charAt(M)=="-"&&this.signum()==0&&(d=!0);continue}y=s*y+b,++g>=a&&(this.dMultiply(u),this.dAddOffset(y,0),g=0,y=0)}g>0&&(this.dMultiply(Math.pow(s,g)),this.dAddOffset(y,0)),d&&h.ZERO.subTo(this,this)}function nl(n,s,a){if(typeof s=="number")if(n<2)this.fromInt(1);else for(this.fromNumber(n,a),this.testBit(n-1)||this.bitwiseTo(h.ONE.shiftLeft(n-1),rr,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(s);)this.dAddOffset(2,0),this.bitLength()>n&&this.subTo(h.ONE.shiftLeft(n-1),this);else{var u=new Array,d=n&7;u.length=(n>>3)+1,s.nextBytes(u),d>0?u[0]&=(1<<d)-1:u[0]=0,this.fromString(u,256)}}function il(){var n=this.t,s=new Array;s[0]=this.s;var a=this.DB-n*this.DB%8,u,d=0;if(n-- >0)for(a<this.DB&&(u=this[n]>>a)!=(this.s&this.DM)>>a&&(s[d++]=u|this.s<<this.DB-a);n>=0;)a<8?(u=(this[n]&(1<<a)-1)<<8-a,u|=this[--n]>>(a+=this.DB-8)):(u=this[n]>>(a-=8)&255,a<=0&&(a+=this.DB,--n)),(u&128)!=0&&(u|=-256),d==0&&(this.s&128)!=(u&128)&&++d,(d>0||u!=this.s)&&(s[d++]=u);return s}function rl(n){return this.compareTo(n)==0}function sl(n){return this.compareTo(n)<0?this:n}function ol(n){return this.compareTo(n)>0?this:n}function al(n,s,a){var u,d,g=Math.min(n.t,this.t);for(u=0;u<g;++u)a[u]=s(this[u],n[u]);if(n.t<this.t){for(d=n.s&this.DM,u=g;u<this.t;++u)a[u]=s(this[u],d);a.t=this.t}else{for(d=this.s&this.DM,u=g;u<n.t;++u)a[u]=s(d,n[u]);a.t=n.t}a.s=s(this.s,n.s),a.clamp()}function ll(n,s){return n&s}function cl(n){var s=p();return this.bitwiseTo(n,ll,s),s}function rr(n,s){return n|s}function ul(n){var s=p();return this.bitwiseTo(n,rr,s),s}function Ls(n,s){return n^s}function hl(n){var s=p();return this.bitwiseTo(n,Ls,s),s}function Ns(n,s){return n&~s}function fl(n){var s=p();return this.bitwiseTo(n,Ns,s),s}function dl(){for(var n=p(),s=0;s<this.t;++s)n[s]=this.DM&~this[s];return n.t=this.t,n.s=~this.s,n}function pl(n){var s=p();return n<0?this.rShiftTo(-n,s):this.lShiftTo(n,s),s}function ml(n){var s=p();return n<0?this.lShiftTo(-n,s):this.rShiftTo(n,s),s}function gl(n){if(n==0)return-1;var s=0;return(n&65535)==0&&(n>>=16,s+=16),(n&255)==0&&(n>>=8,s+=8),(n&15)==0&&(n>>=4,s+=4),(n&3)==0&&(n>>=2,s+=2),(n&1)==0&&++s,s}function xl(){for(var n=0;n<this.t;++n)if(this[n]!=0)return n*this.DB+gl(this[n]);return this.s<0?this.t*this.DB:-1}function _l(n){for(var s=0;n!=0;)n&=n-1,++s;return s}function yl(){for(var n=0,s=this.s&this.DM,a=0;a<this.t;++a)n+=_l(this[a]^s);return n}function vl(n){var s=Math.floor(n/this.DB);return s>=this.t?this.s!=0:(this[s]&1<<n%this.DB)!=0}function Sl(n,s){var a=h.ONE.shiftLeft(n);return this.bitwiseTo(a,s,a),a}function Ml(n){return this.changeBit(n,rr)}function bl(n){return this.changeBit(n,Ns)}function El(n){return this.changeBit(n,Ls)}function Tl(n,s){for(var a=0,u=0,d=Math.min(n.t,this.t);a<d;)u+=this[a]+n[a],s[a++]=u&this.DM,u>>=this.DB;if(n.t<this.t){for(u+=n.s;a<this.t;)u+=this[a],s[a++]=u&this.DM,u>>=this.DB;u+=this.s}else{for(u+=this.s;a<n.t;)u+=n[a],s[a++]=u&this.DM,u>>=this.DB;u+=n.s}s.s=u<0?-1:0,u>0?s[a++]=u:u<-1&&(s[a++]=this.DV+u),s.t=a,s.clamp()}function wl(n){var s=p();return this.addTo(n,s),s}function Al(n){var s=p();return this.subTo(n,s),s}function Cl(n){var s=p();return this.multiplyTo(n,s),s}function Pl(){var n=p();return this.squareTo(n),n}function Il(n){var s=p();return this.divRemTo(n,s,null),s}function Rl(n){var s=p();return this.divRemTo(n,null,s),s}function Ll(n){var s=p(),a=p();return this.divRemTo(n,s,a),new Array(s,a)}function Nl(n){this[this.t]=this.am(0,n-1,this,0,0,this.t),++this.t,this.clamp()}function Dl(n,s){if(n!=0){for(;this.t<=s;)this[this.t++]=0;for(this[s]+=n;this[s]>=this.DV;)this[s]-=this.DV,++s>=this.t&&(this[this.t++]=0),++this[s]}}function dn(){}function Ds(n){return n}function Ol(n,s,a){n.multiplyTo(s,a)}function Fl(n,s){n.squareTo(s)}dn.prototype.convert=Ds,dn.prototype.revert=Ds,dn.prototype.mulTo=Ol,dn.prototype.sqrTo=Fl;function Bl(n){return this.exp(n,new dn)}function Ul(n,s,a){var u=Math.min(this.t+n.t,s);for(a.s=0,a.t=u;u>0;)a[--u]=0;var d;for(d=a.t-this.t;u<d;++u)a[u+this.t]=this.am(0,n[u],a,u,0,this.t);for(d=Math.min(n.t,s);u<d;++u)this.am(0,n[u],a,u,0,s-u);a.clamp()}function zl(n,s,a){--s;var u=a.t=this.t+n.t-s;for(a.s=0;--u>=0;)a[u]=0;for(u=Math.max(s-this.t,0);u<n.t;++u)a[this.t+u-s]=this.am(s-u,n[u],a,0,0,this.t+u-s);a.clamp(),a.drShiftTo(1,a)}function De(n){this.r2=p(),this.q3=p(),h.ONE.dlShiftTo(2*n.t,this.r2),this.mu=this.r2.divide(n),this.m=n}function kl(n){if(n.s<0||n.t>2*this.m.t)return n.mod(this.m);if(n.compareTo(this.m)<0)return n;var s=p();return n.copyTo(s),this.reduce(s),s}function Vl(n){return n}function Hl(n){for(n.drShiftTo(this.m.t-1,this.r2),n.t>this.m.t+1&&(n.t=this.m.t+1,n.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);n.compareTo(this.r2)<0;)n.dAddOffset(1,this.m.t+1);for(n.subTo(this.r2,n);n.compareTo(this.m)>=0;)n.subTo(this.m,n)}function Gl(n,s){n.squareTo(s),this.reduce(s)}function Xl(n,s,a){n.multiplyTo(s,a),this.reduce(a)}De.prototype.convert=kl,De.prototype.revert=Vl,De.prototype.reduce=Hl,De.prototype.mulTo=Xl,De.prototype.sqrTo=Gl;function Wl(n,s){var a=n.bitLength(),u,d=B(1),g;if(a<=0)return d;a<18?u=1:a<48?u=3:a<144?u=4:a<768?u=5:u=6,a<8?g=new Ht(s):s.isEven()?g=new De(s):g=new Ft(s);var y=new Array,M=3,b=u-1,A=(1<<u)-1;if(y[1]=g.convert(this),u>1){var L=p();for(g.sqrTo(y[1],L);M<=A;)y[M]=p(),g.mulTo(L,y[M-2],y[M]),M+=2}var R=n.t-1,F,G=!0,J=p(),K;for(a=W(n[R])-1;R>=0;){for(a>=b?F=n[R]>>a-b&A:(F=(n[R]&(1<<a+1)-1)<<b-a,R>0&&(F|=n[R-1]>>this.DB+a-b)),M=u;(F&1)==0;)F>>=1,--M;if((a-=M)<0&&(a+=this.DB,--R),G)y[F].copyTo(d),G=!1;else{for(;M>1;)g.sqrTo(d,J),g.sqrTo(J,d),M-=2;M>0?g.sqrTo(d,J):(K=d,d=J,J=K),g.mulTo(J,y[F],d)}for(;R>=0&&(n[R]&1<<a)==0;)g.sqrTo(d,J),K=d,d=J,J=K,--a<0&&(a=this.DB-1,--R)}return g.revert(d)}function Yl(n){var s=this.s<0?this.negate():this.clone(),a=n.s<0?n.negate():n.clone();if(s.compareTo(a)<0){var u=s;s=a,a=u}var d=s.getLowestSetBit(),g=a.getLowestSetBit();if(g<0)return s;for(d<g&&(g=d),g>0&&(s.rShiftTo(g,s),a.rShiftTo(g,a));s.signum()>0;)(d=s.getLowestSetBit())>0&&s.rShiftTo(d,s),(d=a.getLowestSetBit())>0&&a.rShiftTo(d,a),s.compareTo(a)>=0?(s.subTo(a,s),s.rShiftTo(1,s)):(a.subTo(s,a),a.rShiftTo(1,a));return g>0&&a.lShiftTo(g,a),a}function ql(n){if(n<=0)return 0;var s=this.DV%n,a=this.s<0?n-1:0;if(this.t>0)if(s==0)a=this[0]%n;else for(var u=this.t-1;u>=0;--u)a=(s*a+this[u])%n;return a}function Zl(n){var s=n.isEven();if(this.isEven()&&s||n.signum()==0)return h.ZERO;for(var a=n.clone(),u=this.clone(),d=B(1),g=B(0),y=B(0),M=B(1);a.signum()!=0;){for(;a.isEven();)a.rShiftTo(1,a),s?((!d.isEven()||!g.isEven())&&(d.addTo(this,d),g.subTo(n,g)),d.rShiftTo(1,d)):g.isEven()||g.subTo(n,g),g.rShiftTo(1,g);for(;u.isEven();)u.rShiftTo(1,u),s?((!y.isEven()||!M.isEven())&&(y.addTo(this,y),M.subTo(n,M)),y.rShiftTo(1,y)):M.isEven()||M.subTo(n,M),M.rShiftTo(1,M);a.compareTo(u)>=0?(a.subTo(u,a),s&&d.subTo(y,d),g.subTo(M,g)):(u.subTo(a,u),s&&y.subTo(d,y),M.subTo(g,M))}if(u.compareTo(h.ONE)!=0)return h.ZERO;if(M.compareTo(n)>=0)return M.subtract(n);if(M.signum()<0)M.addTo(n,M);else return M;return M.signum()<0?M.add(n):M}var vt=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],Jl=(1<<26)/vt[vt.length-1];function Kl(n){var s,a=this.abs();if(a.t==1&&a[0]<=vt[vt.length-1]){for(s=0;s<vt.length;++s)if(a[0]==vt[s])return!0;return!1}if(a.isEven())return!1;for(s=1;s<vt.length;){for(var u=vt[s],d=s+1;d<vt.length&&u<Jl;)u*=vt[d++];for(u=a.modInt(u);s<d;)if(u%vt[s++]==0)return!1}return a.millerRabin(n)}function $l(n){var s=this.subtract(h.ONE),a=s.getLowestSetBit();if(a<=0)return!1;var u=s.shiftRight(a);n=n+1>>1,n>vt.length&&(n=vt.length);for(var d=p(),g=0;g<n;++g){d.fromInt(vt[Math.floor(Math.random()*vt.length)]);var y=d.modPow(u,this);if(y.compareTo(h.ONE)!=0&&y.compareTo(s)!=0){for(var M=1;M++<a&&y.compareTo(s)!=0;)if(y=y.modPowInt(2,this),y.compareTo(h.ONE)==0)return!1;if(y.compareTo(s)!=0)return!1}}return!0}h.prototype.chunkSize=ja,h.prototype.toRadix=tl,h.prototype.fromRadix=el,h.prototype.fromNumber=nl,h.prototype.bitwiseTo=al,h.prototype.changeBit=Sl,h.prototype.addTo=Tl,h.prototype.dMultiply=Nl,h.prototype.dAddOffset=Dl,h.prototype.multiplyLowerTo=Ul,h.prototype.multiplyUpperTo=zl,h.prototype.modInt=ql,h.prototype.millerRabin=$l,h.prototype.clone=Za,h.prototype.intValue=Ja,h.prototype.byteValue=Ka,h.prototype.shortValue=$a,h.prototype.signum=Qa,h.prototype.toByteArray=il,h.prototype.equals=rl,h.prototype.min=sl,h.prototype.max=ol,h.prototype.and=cl,h.prototype.or=ul,h.prototype.xor=hl,h.prototype.andNot=fl,h.prototype.not=dl,h.prototype.shiftLeft=pl,h.prototype.shiftRight=ml,h.prototype.getLowestSetBit=xl,h.prototype.bitCount=yl,h.prototype.testBit=vl,h.prototype.setBit=Ml,h.prototype.clearBit=bl,h.prototype.flipBit=El,h.prototype.add=wl,h.prototype.subtract=Al,h.prototype.multiply=Cl,h.prototype.divide=Il,h.prototype.remainder=Rl,h.prototype.divideAndRemainder=Ll,h.prototype.modPow=Wl,h.prototype.modInverse=Zl,h.prototype.pow=Bl,h.prototype.gcd=Yl,h.prototype.isProbablePrime=Kl,h.prototype.square=Pl;var Z=h;Z.prototype.IsNegative=function(){return this.compareTo(Z.ZERO)==-1},Z.op_Equality=function(n,s){return n.compareTo(s)==0},Z.op_Inequality=function(n,s){return n.compareTo(s)!=0},Z.op_GreaterThan=function(n,s){return n.compareTo(s)>0},Z.op_LessThan=function(n,s){return n.compareTo(s)<0},Z.op_Addition=function(n,s){return new Z(n,void 0,void 0).add(new Z(s,void 0,void 0))},Z.op_Subtraction=function(n,s){return new Z(n,void 0,void 0).subtract(new Z(s,void 0,void 0))},Z.Int128Mul=function(n,s){return new Z(n,void 0,void 0).multiply(new Z(s,void 0,void 0))},Z.op_Division=function(n,s){return n.divide(s)},Z.prototype.ToDouble=function(){return parseFloat(this.toString())};var Os=function(n,s){var a;if(typeof Object.getOwnPropertyNames>"u"){for(a in s.prototype)(typeof n.prototype[a]>"u"||n.prototype[a]===Object.prototype[a])&&(n.prototype[a]=s.prototype[a]);for(a in s)typeof n[a]>"u"&&(n[a]=s[a]);n.$baseCtor=s}else{for(var u=Object.getOwnPropertyNames(s.prototype),d=0;d<u.length;d++)typeof Object.getOwnPropertyDescriptor(n.prototype,u[d])>"u"&&Object.defineProperty(n.prototype,u[d],Object.getOwnPropertyDescriptor(s.prototype,u[d]));for(a in s)typeof n[a]>"u"&&(n[a]=s[a]);n.$baseCtor=s}};i.Path=function(){return[]},i.Path.prototype.push=Array.prototype.push,i.Paths=function(){return[]},i.Paths.prototype.push=Array.prototype.push,i.DoublePoint=function(){var n=arguments;this.X=0,this.Y=0,n.length===1?(this.X=n[0].X,this.Y=n[0].Y):n.length===2&&(this.X=n[0],this.Y=n[1])},i.DoublePoint0=function(){this.X=0,this.Y=0},i.DoublePoint0.prototype=i.DoublePoint.prototype,i.DoublePoint1=function(n){this.X=n.X,this.Y=n.Y},i.DoublePoint1.prototype=i.DoublePoint.prototype,i.DoublePoint2=function(n,s){this.X=n,this.Y=s},i.DoublePoint2.prototype=i.DoublePoint.prototype,i.PolyNode=function(){this.m_Parent=null,this.m_polygon=new i.Path,this.m_Index=0,this.m_jointype=0,this.m_endtype=0,this.m_Childs=[],this.IsOpen=!1},i.PolyNode.prototype.IsHoleNode=function(){for(var n=!0,s=this.m_Parent;s!==null;)n=!n,s=s.m_Parent;return n},i.PolyNode.prototype.ChildCount=function(){return this.m_Childs.length},i.PolyNode.prototype.Contour=function(){return this.m_polygon},i.PolyNode.prototype.AddChild=function(n){var s=this.m_Childs.length;this.m_Childs.push(n),n.m_Parent=this,n.m_Index=s},i.PolyNode.prototype.GetNext=function(){return this.m_Childs.length>0?this.m_Childs[0]:this.GetNextSiblingUp()},i.PolyNode.prototype.GetNextSiblingUp=function(){return this.m_Parent===null?null:this.m_Index===this.m_Parent.m_Childs.length-1?this.m_Parent.GetNextSiblingUp():this.m_Parent.m_Childs[this.m_Index+1]},i.PolyNode.prototype.Childs=function(){return this.m_Childs},i.PolyNode.prototype.Parent=function(){return this.m_Parent},i.PolyNode.prototype.IsHole=function(){return this.IsHoleNode()},i.PolyTree=function(){this.m_AllPolys=[],i.PolyNode.call(this)},i.PolyTree.prototype.Clear=function(){for(var n=0,s=this.m_AllPolys.length;n<s;n++)this.m_AllPolys[n]=null;this.m_AllPolys.length=0,this.m_Childs.length=0},i.PolyTree.prototype.GetFirst=function(){return this.m_Childs.length>0?this.m_Childs[0]:null},i.PolyTree.prototype.Total=function(){var n=this.m_AllPolys.length;return n>0&&this.m_Childs[0]!==this.m_AllPolys[0]&&n--,n},Os(i.PolyTree,i.PolyNode),i.Math_Abs_Int64=i.Math_Abs_Int32=i.Math_Abs_Double=function(n){return Math.abs(n)},i.Math_Max_Int32_Int32=function(n,s){return Math.max(n,s)},o.msie||o.opera||o.safari?i.Cast_Int32=function(n){return n|0}:i.Cast_Int32=function(n){return~~n},typeof Number.toInteger>"u"&&(Number.toInteger=null),o.chrome?i.Cast_Int64=function(n){return n<-2147483648||n>2147483647?n<0?Math.ceil(n):Math.floor(n):~~n}:o.firefox&&typeof Number.toInteger=="function"?i.Cast_Int64=function(n){return Number.toInteger(n)}:o.msie7||o.msie8?i.Cast_Int64=function(n){return parseInt(n,10)}:o.msie?i.Cast_Int64=function(n){return n<-2147483648||n>2147483647?n<0?Math.ceil(n):Math.floor(n):n|0}:i.Cast_Int64=function(n){return n<0?Math.ceil(n):Math.floor(n)},i.Clear=function(n){n.length=0},i.PI=3.141592653589793,i.PI2=2*3.141592653589793,i.IntPoint=function(){var n=arguments,s=n.length;if(this.X=0,this.Y=0,i.use_xyz)if(this.Z=0,s===3)this.X=n[0],this.Y=n[1],this.Z=n[2];else if(s===2)this.X=n[0],this.Y=n[1],this.Z=0;else if(s===1)if(n[0]instanceof i.DoublePoint){var a=n[0];this.X=i.Clipper.Round(a.X),this.Y=i.Clipper.Round(a.Y),this.Z=0}else{var u=n[0];typeof u.Z>"u"&&(u.Z=0),this.X=u.X,this.Y=u.Y,this.Z=u.Z}else this.X=0,this.Y=0,this.Z=0;else if(s===2)this.X=n[0],this.Y=n[1];else if(s===1)if(n[0]instanceof i.DoublePoint){var a=n[0];this.X=i.Clipper.Round(a.X),this.Y=i.Clipper.Round(a.Y)}else{var u=n[0];this.X=u.X,this.Y=u.Y}else this.X=0,this.Y=0},i.IntPoint.op_Equality=function(n,s){return n.X===s.X&&n.Y===s.Y},i.IntPoint.op_Inequality=function(n,s){return n.X!==s.X||n.Y!==s.Y},i.IntPoint0=function(){this.X=0,this.Y=0,i.use_xyz&&(this.Z=0)},i.IntPoint0.prototype=i.IntPoint.prototype,i.IntPoint1=function(n){this.X=n.X,this.Y=n.Y,i.use_xyz&&(typeof n.Z>"u"?this.Z=0:this.Z=n.Z)},i.IntPoint1.prototype=i.IntPoint.prototype,i.IntPoint1dp=function(n){this.X=i.Clipper.Round(n.X),this.Y=i.Clipper.Round(n.Y),i.use_xyz&&(this.Z=0)},i.IntPoint1dp.prototype=i.IntPoint.prototype,i.IntPoint2=function(n,s,a){this.X=n,this.Y=s,i.use_xyz&&(typeof a>"u"?this.Z=0:this.Z=a)},i.IntPoint2.prototype=i.IntPoint.prototype,i.IntRect=function(){var n=arguments,s=n.length;if(s===4)this.left=n[0],this.top=n[1],this.right=n[2],this.bottom=n[3];else if(s===1){var a=n[0];this.left=a.left,this.top=a.top,this.right=a.right,this.bottom=a.bottom}else this.left=0,this.top=0,this.right=0,this.bottom=0},i.IntRect0=function(){this.left=0,this.top=0,this.right=0,this.bottom=0},i.IntRect0.prototype=i.IntRect.prototype,i.IntRect1=function(n){this.left=n.left,this.top=n.top,this.right=n.right,this.bottom=n.bottom},i.IntRect1.prototype=i.IntRect.prototype,i.IntRect4=function(n,s,a,u){this.left=n,this.top=s,this.right=a,this.bottom=u},i.IntRect4.prototype=i.IntRect.prototype,i.ClipType={ctIntersection:0,ctUnion:1,ctDifference:2,ctXor:3},i.PolyType={ptSubject:0,ptClip:1},i.PolyFillType={pftEvenOdd:0,pftNonZero:1,pftPositive:2,pftNegative:3},i.JoinType={jtSquare:0,jtRound:1,jtMiter:2},i.EndType={etOpenSquare:0,etOpenRound:1,etOpenButt:2,etClosedLine:3,etClosedPolygon:4},i.EdgeSide={esLeft:0,esRight:1},i.Direction={dRightToLeft:0,dLeftToRight:1},i.TEdge=function(){this.Bot=new i.IntPoint0,this.Curr=new i.IntPoint0,this.Top=new i.IntPoint0,this.Delta=new i.IntPoint0,this.Dx=0,this.PolyTyp=i.PolyType.ptSubject,this.Side=i.EdgeSide.esLeft,this.WindDelta=0,this.WindCnt=0,this.WindCnt2=0,this.OutIdx=0,this.Next=null,this.Prev=null,this.NextInLML=null,this.NextInAEL=null,this.PrevInAEL=null,this.NextInSEL=null,this.PrevInSEL=null},i.IntersectNode=function(){this.Edge1=null,this.Edge2=null,this.Pt=new i.IntPoint0},i.MyIntersectNodeSort=function(){},i.MyIntersectNodeSort.Compare=function(n,s){var a=s.Pt.Y-n.Pt.Y;return a>0?1:a<0?-1:0},i.LocalMinima=function(){this.Y=0,this.LeftBound=null,this.RightBound=null,this.Next=null},i.Scanbeam=function(){this.Y=0,this.Next=null},i.Maxima=function(){this.X=0,this.Next=null,this.Prev=null},i.OutRec=function(){this.Idx=0,this.IsHole=!1,this.IsOpen=!1,this.FirstLeft=null,this.Pts=null,this.BottomPt=null,this.PolyNode=null},i.OutPt=function(){this.Idx=0,this.Pt=new i.IntPoint0,this.Next=null,this.Prev=null},i.Join=function(){this.OutPt1=null,this.OutPt2=null,this.OffPt=new i.IntPoint0},i.ClipperBase=function(){this.m_MinimaList=null,this.m_CurrentLM=null,this.m_edges=new Array,this.m_UseFullRange=!1,this.m_HasOpenPaths=!1,this.PreserveCollinear=!1,this.m_Scanbeam=null,this.m_PolyOuts=null,this.m_ActiveEdges=null},i.ClipperBase.horizontal=-9007199254740992,i.ClipperBase.Skip=-2,i.ClipperBase.Unassigned=-1,i.ClipperBase.tolerance=1e-20,i.ClipperBase.loRange=47453132,i.ClipperBase.hiRange=0xfffffffffffff,i.ClipperBase.near_zero=function(n){return n>-i.ClipperBase.tolerance&&n<i.ClipperBase.tolerance},i.ClipperBase.IsHorizontal=function(n){return n.Delta.Y===0},i.ClipperBase.prototype.PointIsVertex=function(n,s){var a=s;do{if(i.IntPoint.op_Equality(a.Pt,n))return!0;a=a.Next}while(a!==s);return!1},i.ClipperBase.prototype.PointOnLineSegment=function(n,s,a,u){return u?n.X===s.X&&n.Y===s.Y||n.X===a.X&&n.Y===a.Y||n.X>s.X==n.X<a.X&&n.Y>s.Y==n.Y<a.Y&&Z.op_Equality(Z.Int128Mul(n.X-s.X,a.Y-s.Y),Z.Int128Mul(a.X-s.X,n.Y-s.Y)):n.X===s.X&&n.Y===s.Y||n.X===a.X&&n.Y===a.Y||n.X>s.X==n.X<a.X&&n.Y>s.Y==n.Y<a.Y&&(n.X-s.X)*(a.Y-s.Y)===(a.X-s.X)*(n.Y-s.Y)},i.ClipperBase.prototype.PointOnPolygon=function(n,s,a){for(var u=s;;){if(this.PointOnLineSegment(n,u.Pt,u.Next.Pt,a))return!0;if(u=u.Next,u===s)break}return!1},i.ClipperBase.prototype.SlopesEqual=i.ClipperBase.SlopesEqual=function(){var n=arguments,s=n.length,a,u,d,g,y,M,b;return s===3?(a=n[0],u=n[1],b=n[2],b?Z.op_Equality(Z.Int128Mul(a.Delta.Y,u.Delta.X),Z.Int128Mul(a.Delta.X,u.Delta.Y)):i.Cast_Int64(a.Delta.Y*u.Delta.X)===i.Cast_Int64(a.Delta.X*u.Delta.Y)):s===4?(d=n[0],g=n[1],y=n[2],b=n[3],b?Z.op_Equality(Z.Int128Mul(d.Y-g.Y,g.X-y.X),Z.Int128Mul(d.X-g.X,g.Y-y.Y)):i.Cast_Int64((d.Y-g.Y)*(g.X-y.X))-i.Cast_Int64((d.X-g.X)*(g.Y-y.Y))===0):(d=n[0],g=n[1],y=n[2],M=n[3],b=n[4],b?Z.op_Equality(Z.Int128Mul(d.Y-g.Y,y.X-M.X),Z.Int128Mul(d.X-g.X,y.Y-M.Y)):i.Cast_Int64((d.Y-g.Y)*(y.X-M.X))-i.Cast_Int64((d.X-g.X)*(y.Y-M.Y))===0)},i.ClipperBase.SlopesEqual3=function(n,s,a){return a?Z.op_Equality(Z.Int128Mul(n.Delta.Y,s.Delta.X),Z.Int128Mul(n.Delta.X,s.Delta.Y)):i.Cast_Int64(n.Delta.Y*s.Delta.X)===i.Cast_Int64(n.Delta.X*s.Delta.Y)},i.ClipperBase.SlopesEqual4=function(n,s,a,u){return u?Z.op_Equality(Z.Int128Mul(n.Y-s.Y,s.X-a.X),Z.Int128Mul(n.X-s.X,s.Y-a.Y)):i.Cast_Int64((n.Y-s.Y)*(s.X-a.X))-i.Cast_Int64((n.X-s.X)*(s.Y-a.Y))===0},i.ClipperBase.SlopesEqual5=function(n,s,a,u,d){return d?Z.op_Equality(Z.Int128Mul(n.Y-s.Y,a.X-u.X),Z.Int128Mul(n.X-s.X,a.Y-u.Y)):i.Cast_Int64((n.Y-s.Y)*(a.X-u.X))-i.Cast_Int64((n.X-s.X)*(a.Y-u.Y))===0},i.ClipperBase.prototype.Clear=function(){this.DisposeLocalMinimaList();for(var n=0,s=this.m_edges.length;n<s;++n){for(var a=0,u=this.m_edges[n].length;a<u;++a)this.m_edges[n][a]=null;i.Clear(this.m_edges[n])}i.Clear(this.m_edges),this.m_UseFullRange=!1,this.m_HasOpenPaths=!1},i.ClipperBase.prototype.DisposeLocalMinimaList=function(){for(;this.m_MinimaList!==null;){var n=this.m_MinimaList.Next;this.m_MinimaList=null,this.m_MinimaList=n}this.m_CurrentLM=null},i.ClipperBase.prototype.RangeTest=function(n,s){s.Value?(n.X>i.ClipperBase.hiRange||n.Y>i.ClipperBase.hiRange||-n.X>i.ClipperBase.hiRange||-n.Y>i.ClipperBase.hiRange)&&i.Error("Coordinate outside allowed range in RangeTest()."):(n.X>i.ClipperBase.loRange||n.Y>i.ClipperBase.loRange||-n.X>i.ClipperBase.loRange||-n.Y>i.ClipperBase.loRange)&&(s.Value=!0,this.RangeTest(n,s))},i.ClipperBase.prototype.InitEdge=function(n,s,a,u){n.Next=s,n.Prev=a,n.Curr.X=u.X,n.Curr.Y=u.Y,i.use_xyz&&(n.Curr.Z=u.Z),n.OutIdx=-1},i.ClipperBase.prototype.InitEdge2=function(n,s){n.Curr.Y>=n.Next.Curr.Y?(n.Bot.X=n.Curr.X,n.Bot.Y=n.Curr.Y,i.use_xyz&&(n.Bot.Z=n.Curr.Z),n.Top.X=n.Next.Curr.X,n.Top.Y=n.Next.Curr.Y,i.use_xyz&&(n.Top.Z=n.Next.Curr.Z)):(n.Top.X=n.Curr.X,n.Top.Y=n.Curr.Y,i.use_xyz&&(n.Top.Z=n.Curr.Z),n.Bot.X=n.Next.Curr.X,n.Bot.Y=n.Next.Curr.Y,i.use_xyz&&(n.Bot.Z=n.Next.Curr.Z)),this.SetDx(n),n.PolyTyp=s},i.ClipperBase.prototype.FindNextLocMin=function(n){for(var s;;){for(;i.IntPoint.op_Inequality(n.Bot,n.Prev.Bot)||i.IntPoint.op_Equality(n.Curr,n.Top);)n=n.Next;if(n.Dx!==i.ClipperBase.horizontal&&n.Prev.Dx!==i.ClipperBase.horizontal)break;for(;n.Prev.Dx===i.ClipperBase.horizontal;)n=n.Prev;for(s=n;n.Dx===i.ClipperBase.horizontal;)n=n.Next;if(n.Top.Y!==n.Prev.Bot.Y){s.Prev.Bot.X<n.Bot.X&&(n=s);break}}return n},i.ClipperBase.prototype.ProcessBound=function(n,s){var a,u=n,d;if(u.OutIdx===i.ClipperBase.Skip){if(n=u,s){for(;n.Top.Y===n.Next.Bot.Y;)n=n.Next;for(;n!==u&&n.Dx===i.ClipperBase.horizontal;)n=n.Prev}else{for(;n.Top.Y===n.Prev.Bot.Y;)n=n.Prev;for(;n!==u&&n.Dx===i.ClipperBase.horizontal;)n=n.Next}if(n===u)s?u=n.Next:u=n.Prev;else{s?n=u.Next:n=u.Prev;var g=new i.LocalMinima;g.Next=null,g.Y=n.Bot.Y,g.LeftBound=null,g.RightBound=n,n.WindDelta=0,u=this.ProcessBound(n,s),this.InsertLocalMinima(g)}return u}if(n.Dx===i.ClipperBase.horizontal&&(s?a=n.Prev:a=n.Next,a.Dx===i.ClipperBase.horizontal?a.Bot.X!==n.Bot.X&&a.Top.X!==n.Bot.X&&this.ReverseHorizontal(n):a.Bot.X!==n.Bot.X&&this.ReverseHorizontal(n)),a=n,s){for(;u.Top.Y===u.Next.Bot.Y&&u.Next.OutIdx!==i.ClipperBase.Skip;)u=u.Next;if(u.Dx===i.ClipperBase.horizontal&&u.Next.OutIdx!==i.ClipperBase.Skip){for(d=u;d.Prev.Dx===i.ClipperBase.horizontal;)d=d.Prev;d.Prev.Top.X>u.Next.Top.X&&(u=d.Prev)}for(;n!==u;)n.NextInLML=n.Next,n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Prev.Top.X&&this.ReverseHorizontal(n),n=n.Next;n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Prev.Top.X&&this.ReverseHorizontal(n),u=u.Next}else{for(;u.Top.Y===u.Prev.Bot.Y&&u.Prev.OutIdx!==i.ClipperBase.Skip;)u=u.Prev;if(u.Dx===i.ClipperBase.horizontal&&u.Prev.OutIdx!==i.ClipperBase.Skip){for(d=u;d.Next.Dx===i.ClipperBase.horizontal;)d=d.Next;(d.Next.Top.X===u.Prev.Top.X||d.Next.Top.X>u.Prev.Top.X)&&(u=d.Next)}for(;n!==u;)n.NextInLML=n.Prev,n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Next.Top.X&&this.ReverseHorizontal(n),n=n.Prev;n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Next.Top.X&&this.ReverseHorizontal(n),u=u.Prev}return u},i.ClipperBase.prototype.AddPath=function(n,s,a){i.use_lines?!a&&s===i.PolyType.ptClip&&i.Error("AddPath: Open paths must be subject."):a||i.Error("AddPath: Open paths have been disabled.");var u=n.length-1;if(a)for(;u>0&&i.IntPoint.op_Equality(n[u],n[0]);)--u;for(;u>0&&i.IntPoint.op_Equality(n[u],n[u-1]);)--u;if(a&&u<2||!a&&u<1)return!1;for(var d=new Array,g=0;g<=u;g++)d.push(new i.TEdge);var y=!0;d[1].Curr.X=n[1].X,d[1].Curr.Y=n[1].Y,i.use_xyz&&(d[1].Curr.Z=n[1].Z);var M={Value:this.m_UseFullRange};this.RangeTest(n[0],M),this.m_UseFullRange=M.Value,M.Value=this.m_UseFullRange,this.RangeTest(n[u],M),this.m_UseFullRange=M.Value,this.InitEdge(d[0],d[1],d[u],n[0]),this.InitEdge(d[u],d[0],d[u-1],n[u]);for(var g=u-1;g>=1;--g)M.Value=this.m_UseFullRange,this.RangeTest(n[g],M),this.m_UseFullRange=M.Value,this.InitEdge(d[g],d[g+1],d[g-1],n[g]);for(var b=d[0],A=b,L=b;;){if(A.Curr===A.Next.Curr&&(a||A.Next!==b)){if(A===A.Next)break;A===b&&(b=A.Next),A=this.RemoveEdge(A),L=A;continue}if(A.Prev===A.Next)break;if(a&&i.ClipperBase.SlopesEqual4(A.Prev.Curr,A.Curr,A.Next.Curr,this.m_UseFullRange)&&(!this.PreserveCollinear||!this.Pt2IsBetweenPt1AndPt3(A.Prev.Curr,A.Curr,A.Next.Curr))){A===b&&(b=A.Next),A=this.RemoveEdge(A),A=A.Prev,L=A;continue}if(A=A.Next,A===L||!a&&A.Next===b)break}if(!a&&A===A.Next||a&&A.Prev===A.Next)return!1;a||(this.m_HasOpenPaths=!0,b.Prev.OutIdx=i.ClipperBase.Skip),A=b;do this.InitEdge2(A,s),A=A.Next,y&&A.Curr.Y!==b.Curr.Y&&(y=!1);while(A!==b);if(y){if(a)return!1;A.Prev.OutIdx=i.ClipperBase.Skip;var R=new i.LocalMinima;for(R.Next=null,R.Y=A.Bot.Y,R.LeftBound=null,R.RightBound=A,R.RightBound.Side=i.EdgeSide.esRight,R.RightBound.WindDelta=0;A.Bot.X!==A.Prev.Top.X&&this.ReverseHorizontal(A),A.Next.OutIdx!==i.ClipperBase.Skip;)A.NextInLML=A.Next,A=A.Next;return this.InsertLocalMinima(R),this.m_edges.push(d),!0}this.m_edges.push(d);var F,G=null;for(i.IntPoint.op_Equality(A.Prev.Bot,A.Prev.Top)&&(A=A.Next);A=this.FindNextLocMin(A),A!==G;){G===null&&(G=A);var R=new i.LocalMinima;R.Next=null,R.Y=A.Bot.Y,A.Dx<A.Prev.Dx?(R.LeftBound=A.Prev,R.RightBound=A,F=!1):(R.LeftBound=A,R.RightBound=A.Prev,F=!0),R.LeftBound.Side=i.EdgeSide.esLeft,R.RightBound.Side=i.EdgeSide.esRight,a?R.LeftBound.Next===R.RightBound?R.LeftBound.WindDelta=-1:R.LeftBound.WindDelta=1:R.LeftBound.WindDelta=0,R.RightBound.WindDelta=-R.LeftBound.WindDelta,A=this.ProcessBound(R.LeftBound,F),A.OutIdx===i.ClipperBase.Skip&&(A=this.ProcessBound(A,F));var J=this.ProcessBound(R.RightBound,!F);J.OutIdx===i.ClipperBase.Skip&&(J=this.ProcessBound(J,!F)),R.LeftBound.OutIdx===i.ClipperBase.Skip?R.LeftBound=null:R.RightBound.OutIdx===i.ClipperBase.Skip&&(R.RightBound=null),this.InsertLocalMinima(R),F||(A=J)}return!0},i.ClipperBase.prototype.AddPaths=function(n,s,a){for(var u=!1,d=0,g=n.length;d<g;++d)this.AddPath(n[d],s,a)&&(u=!0);return u},i.ClipperBase.prototype.Pt2IsBetweenPt1AndPt3=function(n,s,a){return i.IntPoint.op_Equality(n,a)||i.IntPoint.op_Equality(n,s)||i.IntPoint.op_Equality(a,s)?!1:n.X!==a.X?s.X>n.X==s.X<a.X:s.Y>n.Y==s.Y<a.Y},i.ClipperBase.prototype.RemoveEdge=function(n){n.Prev.Next=n.Next,n.Next.Prev=n.Prev;var s=n.Next;return n.Prev=null,s},i.ClipperBase.prototype.SetDx=function(n){n.Delta.X=n.Top.X-n.Bot.X,n.Delta.Y=n.Top.Y-n.Bot.Y,n.Delta.Y===0?n.Dx=i.ClipperBase.horizontal:n.Dx=n.Delta.X/n.Delta.Y},i.ClipperBase.prototype.InsertLocalMinima=function(n){if(this.m_MinimaList===null)this.m_MinimaList=n;else if(n.Y>=this.m_MinimaList.Y)n.Next=this.m_MinimaList,this.m_MinimaList=n;else{for(var s=this.m_MinimaList;s.Next!==null&&n.Y<s.Next.Y;)s=s.Next;n.Next=s.Next,s.Next=n}},i.ClipperBase.prototype.PopLocalMinima=function(n,s){return s.v=this.m_CurrentLM,this.m_CurrentLM!==null&&this.m_CurrentLM.Y===n?(this.m_CurrentLM=this.m_CurrentLM.Next,!0):!1},i.ClipperBase.prototype.ReverseHorizontal=function(n){var s=n.Top.X;n.Top.X=n.Bot.X,n.Bot.X=s,i.use_xyz&&(s=n.Top.Z,n.Top.Z=n.Bot.Z,n.Bot.Z=s)},i.ClipperBase.prototype.Reset=function(){if(this.m_CurrentLM=this.m_MinimaList,this.m_CurrentLM!==null){this.m_Scanbeam=null;for(var n=this.m_MinimaList;n!==null;){this.InsertScanbeam(n.Y);var s=n.LeftBound;s!==null&&(s.Curr.X=s.Bot.X,s.Curr.Y=s.Bot.Y,i.use_xyz&&(s.Curr.Z=s.Bot.Z),s.OutIdx=i.ClipperBase.Unassigned),s=n.RightBound,s!==null&&(s.Curr.X=s.Bot.X,s.Curr.Y=s.Bot.Y,i.use_xyz&&(s.Curr.Z=s.Bot.Z),s.OutIdx=i.ClipperBase.Unassigned),n=n.Next}this.m_ActiveEdges=null}},i.ClipperBase.prototype.InsertScanbeam=function(n){if(this.m_Scanbeam===null)this.m_Scanbeam=new i.Scanbeam,this.m_Scanbeam.Next=null,this.m_Scanbeam.Y=n;else if(n>this.m_Scanbeam.Y){var s=new i.Scanbeam;s.Y=n,s.Next=this.m_Scanbeam,this.m_Scanbeam=s}else{for(var a=this.m_Scanbeam;a.Next!==null&&n<=a.Next.Y;)a=a.Next;if(n===a.Y)return;var u=new i.Scanbeam;u.Y=n,u.Next=a.Next,a.Next=u}},i.ClipperBase.prototype.PopScanbeam=function(n){return this.m_Scanbeam===null?(n.v=0,!1):(n.v=this.m_Scanbeam.Y,this.m_Scanbeam=this.m_Scanbeam.Next,!0)},i.ClipperBase.prototype.LocalMinimaPending=function(){return this.m_CurrentLM!==null},i.ClipperBase.prototype.CreateOutRec=function(){var n=new i.OutRec;return n.Idx=i.ClipperBase.Unassigned,n.IsHole=!1,n.IsOpen=!1,n.FirstLeft=null,n.Pts=null,n.BottomPt=null,n.PolyNode=null,this.m_PolyOuts.push(n),n.Idx=this.m_PolyOuts.length-1,n},i.ClipperBase.prototype.DisposeOutRec=function(n){var s=this.m_PolyOuts[n];s.Pts=null,s=null,this.m_PolyOuts[n]=null},i.ClipperBase.prototype.UpdateEdgeIntoAEL=function(n){n.NextInLML===null&&i.Error("UpdateEdgeIntoAEL: invalid call");var s=n.PrevInAEL,a=n.NextInAEL;return n.NextInLML.OutIdx=n.OutIdx,s!==null?s.NextInAEL=n.NextInLML:this.m_ActiveEdges=n.NextInLML,a!==null&&(a.PrevInAEL=n.NextInLML),n.NextInLML.Side=n.Side,n.NextInLML.WindDelta=n.WindDelta,n.NextInLML.WindCnt=n.WindCnt,n.NextInLML.WindCnt2=n.WindCnt2,n=n.NextInLML,n.Curr.X=n.Bot.X,n.Curr.Y=n.Bot.Y,n.PrevInAEL=s,n.NextInAEL=a,i.ClipperBase.IsHorizontal(n)||this.InsertScanbeam(n.Top.Y),n},i.ClipperBase.prototype.SwapPositionsInAEL=function(n,s){if(!(n.NextInAEL===n.PrevInAEL||s.NextInAEL===s.PrevInAEL)){if(n.NextInAEL===s){var a=s.NextInAEL;a!==null&&(a.PrevInAEL=n);var u=n.PrevInAEL;u!==null&&(u.NextInAEL=s),s.PrevInAEL=u,s.NextInAEL=n,n.PrevInAEL=s,n.NextInAEL=a}else if(s.NextInAEL===n){var d=n.NextInAEL;d!==null&&(d.PrevInAEL=s);var g=s.PrevInAEL;g!==null&&(g.NextInAEL=n),n.PrevInAEL=g,n.NextInAEL=s,s.PrevInAEL=n,s.NextInAEL=d}else{var y=n.NextInAEL,M=n.PrevInAEL;n.NextInAEL=s.NextInAEL,n.NextInAEL!==null&&(n.NextInAEL.PrevInAEL=n),n.PrevInAEL=s.PrevInAEL,n.PrevInAEL!==null&&(n.PrevInAEL.NextInAEL=n),s.NextInAEL=y,s.NextInAEL!==null&&(s.NextInAEL.PrevInAEL=s),s.PrevInAEL=M,s.PrevInAEL!==null&&(s.PrevInAEL.NextInAEL=s)}n.PrevInAEL===null?this.m_ActiveEdges=n:s.PrevInAEL===null&&(this.m_ActiveEdges=s)}},i.ClipperBase.prototype.DeleteFromAEL=function(n){var s=n.PrevInAEL,a=n.NextInAEL;s===null&&a===null&&n!==this.m_ActiveEdges||(s!==null?s.NextInAEL=a:this.m_ActiveEdges=a,a!==null&&(a.PrevInAEL=s),n.NextInAEL=null,n.PrevInAEL=null)},i.Clipper=function(n){typeof n>"u"&&(n=0),this.m_PolyOuts=null,this.m_ClipType=i.ClipType.ctIntersection,this.m_Scanbeam=null,this.m_Maxima=null,this.m_ActiveEdges=null,this.m_SortedEdges=null,this.m_IntersectList=null,this.m_IntersectNodeComparer=null,this.m_ExecuteLocked=!1,this.m_ClipFillType=i.PolyFillType.pftEvenOdd,this.m_SubjFillType=i.PolyFillType.pftEvenOdd,this.m_Joins=null,this.m_GhostJoins=null,this.m_UsingPolyTree=!1,this.ReverseSolution=!1,this.StrictlySimple=!1,i.ClipperBase.call(this),this.m_Scanbeam=null,this.m_Maxima=null,this.m_ActiveEdges=null,this.m_SortedEdges=null,this.m_IntersectList=new Array,this.m_IntersectNodeComparer=i.MyIntersectNodeSort.Compare,this.m_ExecuteLocked=!1,this.m_UsingPolyTree=!1,this.m_PolyOuts=new Array,this.m_Joins=new Array,this.m_GhostJoins=new Array,this.ReverseSolution=(1&n)!==0,this.StrictlySimple=(2&n)!==0,this.PreserveCollinear=(4&n)!==0,i.use_xyz&&(this.ZFillFunction=null)},i.Clipper.ioReverseSolution=1,i.Clipper.ioStrictlySimple=2,i.Clipper.ioPreserveCollinear=4,i.Clipper.prototype.Clear=function(){this.m_edges.length!==0&&(this.DisposeAllPolyPts(),i.ClipperBase.prototype.Clear.call(this))},i.Clipper.prototype.InsertMaxima=function(n){var s=new i.Maxima;if(s.X=n,this.m_Maxima===null)this.m_Maxima=s,this.m_Maxima.Next=null,this.m_Maxima.Prev=null;else if(n<this.m_Maxima.X)s.Next=this.m_Maxima,s.Prev=null,this.m_Maxima=s;else{for(var a=this.m_Maxima;a.Next!==null&&n>=a.Next.X;)a=a.Next;if(n===a.X)return;s.Next=a.Next,s.Prev=a,a.Next!==null&&(a.Next.Prev=s),a.Next=s}},i.Clipper.prototype.Execute=function(){var n=arguments,s=n.length,a=n[1]instanceof i.PolyTree;if(s===4&&!a){var u=n[0],d=n[1],g=n[2],y=n[3];if(this.m_ExecuteLocked)return!1;this.m_HasOpenPaths&&i.Error("Error: PolyTree struct is needed for open path clipping."),this.m_ExecuteLocked=!0,i.Clear(d),this.m_SubjFillType=g,this.m_ClipFillType=y,this.m_ClipType=u,this.m_UsingPolyTree=!1;try{var M=this.ExecuteInternal();M&&this.BuildResult(d)}finally{this.DisposeAllPolyPts(),this.m_ExecuteLocked=!1}return M}else if(s===4&&a){var u=n[0],b=n[1],g=n[2],y=n[3];if(this.m_ExecuteLocked)return!1;this.m_ExecuteLocked=!0,this.m_SubjFillType=g,this.m_ClipFillType=y,this.m_ClipType=u,this.m_UsingPolyTree=!0;try{var M=this.ExecuteInternal();M&&this.BuildResult2(b)}finally{this.DisposeAllPolyPts(),this.m_ExecuteLocked=!1}return M}else if(s===2&&!a){var u=n[0],d=n[1];return this.Execute(u,d,i.PolyFillType.pftEvenOdd,i.PolyFillType.pftEvenOdd)}else if(s===2&&a){var u=n[0],b=n[1];return this.Execute(u,b,i.PolyFillType.pftEvenOdd,i.PolyFillType.pftEvenOdd)}},i.Clipper.prototype.FixHoleLinkage=function(n){if(!(n.FirstLeft===null||n.IsHole!==n.FirstLeft.IsHole&&n.FirstLeft.Pts!==null)){for(var s=n.FirstLeft;s!==null&&(s.IsHole===n.IsHole||s.Pts===null);)s=s.FirstLeft;n.FirstLeft=s}},i.Clipper.prototype.ExecuteInternal=function(){try{this.Reset(),this.m_SortedEdges=null,this.m_Maxima=null;var n={},s={};if(!this.PopScanbeam(n))return!1;for(this.InsertLocalMinimaIntoAEL(n.v);this.PopScanbeam(s)||this.LocalMinimaPending();){if(this.ProcessHorizontals(),this.m_GhostJoins.length=0,!this.ProcessIntersections(s.v))return!1;this.ProcessEdgesAtTopOfScanbeam(s.v),n.v=s.v,this.InsertLocalMinimaIntoAEL(n.v)}var a,u,d;for(u=0,d=this.m_PolyOuts.length;u<d;u++)a=this.m_PolyOuts[u],!(a.Pts===null||a.IsOpen)&&(a.IsHole^this.ReverseSolution)==this.Area$1(a)>0&&this.ReversePolyPtLinks(a.Pts);for(this.JoinCommonEdges(),u=0,d=this.m_PolyOuts.length;u<d;u++)a=this.m_PolyOuts[u],a.Pts!==null&&(a.IsOpen?this.FixupOutPolyline(a):this.FixupOutPolygon(a));return this.StrictlySimple&&this.DoSimplePolygons(),!0}finally{this.m_Joins.length=0,this.m_GhostJoins.length=0}},i.Clipper.prototype.DisposeAllPolyPts=function(){for(var n=0,s=this.m_PolyOuts.length;n<s;++n)this.DisposeOutRec(n);i.Clear(this.m_PolyOuts)},i.Clipper.prototype.AddJoin=function(n,s,a){var u=new i.Join;u.OutPt1=n,u.OutPt2=s,u.OffPt.X=a.X,u.OffPt.Y=a.Y,i.use_xyz&&(u.OffPt.Z=a.Z),this.m_Joins.push(u)},i.Clipper.prototype.AddGhostJoin=function(n,s){var a=new i.Join;a.OutPt1=n,a.OffPt.X=s.X,a.OffPt.Y=s.Y,i.use_xyz&&(a.OffPt.Z=s.Z),this.m_GhostJoins.push(a)},i.Clipper.prototype.SetZ=function(n,s,a){if(this.ZFillFunction!==null){if(n.Z!==0||this.ZFillFunction===null)return;i.IntPoint.op_Equality(n,s.Bot)?n.Z=s.Bot.Z:i.IntPoint.op_Equality(n,s.Top)?n.Z=s.Top.Z:i.IntPoint.op_Equality(n,a.Bot)?n.Z=a.Bot.Z:i.IntPoint.op_Equality(n,a.Top)?n.Z=a.Top.Z:this.ZFillFunction(s.Bot,s.Top,a.Bot,a.Top,n)}},i.Clipper.prototype.InsertLocalMinimaIntoAEL=function(n){for(var s={},a,u;this.PopLocalMinima(n,s);){a=s.v.LeftBound,u=s.v.RightBound;var d=null;if(a===null?(this.InsertEdgeIntoAEL(u,null),this.SetWindingCount(u),this.IsContributing(u)&&(d=this.AddOutPt(u,u.Bot))):u===null?(this.InsertEdgeIntoAEL(a,null),this.SetWindingCount(a),this.IsContributing(a)&&(d=this.AddOutPt(a,a.Bot)),this.InsertScanbeam(a.Top.Y)):(this.InsertEdgeIntoAEL(a,null),this.InsertEdgeIntoAEL(u,a),this.SetWindingCount(a),u.WindCnt=a.WindCnt,u.WindCnt2=a.WindCnt2,this.IsContributing(a)&&(d=this.AddLocalMinPoly(a,u,a.Bot)),this.InsertScanbeam(a.Top.Y)),u!==null&&(i.ClipperBase.IsHorizontal(u)?(u.NextInLML!==null&&this.InsertScanbeam(u.NextInLML.Top.Y),this.AddEdgeToSEL(u)):this.InsertScanbeam(u.Top.Y)),!(a===null||u===null)){if(d!==null&&i.ClipperBase.IsHorizontal(u)&&this.m_GhostJoins.length>0&&u.WindDelta!==0)for(var g=0,y=this.m_GhostJoins.length;g<y;g++){var M=this.m_GhostJoins[g];this.HorzSegmentsOverlap(M.OutPt1.Pt.X,M.OffPt.X,u.Bot.X,u.Top.X)&&this.AddJoin(M.OutPt1,d,M.OffPt)}if(a.OutIdx>=0&&a.PrevInAEL!==null&&a.PrevInAEL.Curr.X===a.Bot.X&&a.PrevInAEL.OutIdx>=0&&i.ClipperBase.SlopesEqual5(a.PrevInAEL.Curr,a.PrevInAEL.Top,a.Curr,a.Top,this.m_UseFullRange)&&a.WindDelta!==0&&a.PrevInAEL.WindDelta!==0){var b=this.AddOutPt(a.PrevInAEL,a.Bot);this.AddJoin(d,b,a.Top)}if(a.NextInAEL!==u){if(u.OutIdx>=0&&u.PrevInAEL.OutIdx>=0&&i.ClipperBase.SlopesEqual5(u.PrevInAEL.Curr,u.PrevInAEL.Top,u.Curr,u.Top,this.m_UseFullRange)&&u.WindDelta!==0&&u.PrevInAEL.WindDelta!==0){var b=this.AddOutPt(u.PrevInAEL,u.Bot);this.AddJoin(d,b,u.Top)}var A=a.NextInAEL;if(A!==null)for(;A!==u;)this.IntersectEdges(u,A,a.Curr),A=A.NextInAEL}}}},i.Clipper.prototype.InsertEdgeIntoAEL=function(n,s){if(this.m_ActiveEdges===null)n.PrevInAEL=null,n.NextInAEL=null,this.m_ActiveEdges=n;else if(s===null&&this.E2InsertsBeforeE1(this.m_ActiveEdges,n))n.PrevInAEL=null,n.NextInAEL=this.m_ActiveEdges,this.m_ActiveEdges.PrevInAEL=n,this.m_ActiveEdges=n;else{for(s===null&&(s=this.m_ActiveEdges);s.NextInAEL!==null&&!this.E2InsertsBeforeE1(s.NextInAEL,n);)s=s.NextInAEL;n.NextInAEL=s.NextInAEL,s.NextInAEL!==null&&(s.NextInAEL.PrevInAEL=n),n.PrevInAEL=s,s.NextInAEL=n}},i.Clipper.prototype.E2InsertsBeforeE1=function(n,s){return s.Curr.X===n.Curr.X?s.Top.Y>n.Top.Y?s.Top.X<i.Clipper.TopX(n,s.Top.Y):n.Top.X>i.Clipper.TopX(s,n.Top.Y):s.Curr.X<n.Curr.X},i.Clipper.prototype.IsEvenOddFillType=function(n){return n.PolyTyp===i.PolyType.ptSubject?this.m_SubjFillType===i.PolyFillType.pftEvenOdd:this.m_ClipFillType===i.PolyFillType.pftEvenOdd},i.Clipper.prototype.IsEvenOddAltFillType=function(n){return n.PolyTyp===i.PolyType.ptSubject?this.m_ClipFillType===i.PolyFillType.pftEvenOdd:this.m_SubjFillType===i.PolyFillType.pftEvenOdd},i.Clipper.prototype.IsContributing=function(n){var s,a;switch(n.PolyTyp===i.PolyType.ptSubject?(s=this.m_SubjFillType,a=this.m_ClipFillType):(s=this.m_ClipFillType,a=this.m_SubjFillType),s){case i.PolyFillType.pftEvenOdd:if(n.WindDelta===0&&n.WindCnt!==1)return!1;break;case i.PolyFillType.pftNonZero:if(Math.abs(n.WindCnt)!==1)return!1;break;case i.PolyFillType.pftPositive:if(n.WindCnt!==1)return!1;break;default:if(n.WindCnt!==-1)return!1;break}switch(this.m_ClipType){case i.ClipType.ctIntersection:switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2!==0;case i.PolyFillType.pftPositive:return n.WindCnt2>0;default:return n.WindCnt2<0}case i.ClipType.ctUnion:switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}case i.ClipType.ctDifference:if(n.PolyTyp===i.PolyType.ptSubject)switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}else switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2!==0;case i.PolyFillType.pftPositive:return n.WindCnt2>0;default:return n.WindCnt2<0}case i.ClipType.ctXor:if(n.WindDelta===0)switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}else return!0}return!0},i.Clipper.prototype.SetWindingCount=function(n){for(var s=n.PrevInAEL;s!==null&&(s.PolyTyp!==n.PolyTyp||s.WindDelta===0);)s=s.PrevInAEL;if(s===null){var a=n.PolyTyp===i.PolyType.ptSubject?this.m_SubjFillType:this.m_ClipFillType;n.WindDelta===0?n.WindCnt=a===i.PolyFillType.pftNegative?-1:1:n.WindCnt=n.WindDelta,n.WindCnt2=0,s=this.m_ActiveEdges}else if(n.WindDelta===0&&this.m_ClipType!==i.ClipType.ctUnion)n.WindCnt=1,n.WindCnt2=s.WindCnt2,s=s.NextInAEL;else if(this.IsEvenOddFillType(n)){if(n.WindDelta===0){for(var u=!0,d=s.PrevInAEL;d!==null;)d.PolyTyp===s.PolyTyp&&d.WindDelta!==0&&(u=!u),d=d.PrevInAEL;n.WindCnt=u?0:1}else n.WindCnt=n.WindDelta;n.WindCnt2=s.WindCnt2,s=s.NextInAEL}else s.WindCnt*s.WindDelta<0?Math.abs(s.WindCnt)>1?s.WindDelta*n.WindDelta<0?n.WindCnt=s.WindCnt:n.WindCnt=s.WindCnt+n.WindDelta:n.WindCnt=n.WindDelta===0?1:n.WindDelta:n.WindDelta===0?n.WindCnt=s.WindCnt<0?s.WindCnt-1:s.WindCnt+1:s.WindDelta*n.WindDelta<0?n.WindCnt=s.WindCnt:n.WindCnt=s.WindCnt+n.WindDelta,n.WindCnt2=s.WindCnt2,s=s.NextInAEL;if(this.IsEvenOddAltFillType(n))for(;s!==n;)s.WindDelta!==0&&(n.WindCnt2=n.WindCnt2===0?1:0),s=s.NextInAEL;else for(;s!==n;)n.WindCnt2+=s.WindDelta,s=s.NextInAEL},i.Clipper.prototype.AddEdgeToSEL=function(n){this.m_SortedEdges===null?(this.m_SortedEdges=n,n.PrevInSEL=null,n.NextInSEL=null):(n.NextInSEL=this.m_SortedEdges,n.PrevInSEL=null,this.m_SortedEdges.PrevInSEL=n,this.m_SortedEdges=n)},i.Clipper.prototype.PopEdgeFromSEL=function(n){if(n.v=this.m_SortedEdges,n.v===null)return!1;var s=n.v;return this.m_SortedEdges=n.v.NextInSEL,this.m_SortedEdges!==null&&(this.m_SortedEdges.PrevInSEL=null),s.NextInSEL=null,s.PrevInSEL=null,!0},i.Clipper.prototype.CopyAELToSEL=function(){var n=this.m_ActiveEdges;for(this.m_SortedEdges=n;n!==null;)n.PrevInSEL=n.PrevInAEL,n.NextInSEL=n.NextInAEL,n=n.NextInAEL},i.Clipper.prototype.SwapPositionsInSEL=function(n,s){if(!(n.NextInSEL===null&&n.PrevInSEL===null)&&!(s.NextInSEL===null&&s.PrevInSEL===null)){if(n.NextInSEL===s){var a=s.NextInSEL;a!==null&&(a.PrevInSEL=n);var u=n.PrevInSEL;u!==null&&(u.NextInSEL=s),s.PrevInSEL=u,s.NextInSEL=n,n.PrevInSEL=s,n.NextInSEL=a}else if(s.NextInSEL===n){var a=n.NextInSEL;a!==null&&(a.PrevInSEL=s);var u=s.PrevInSEL;u!==null&&(u.NextInSEL=n),n.PrevInSEL=u,n.NextInSEL=s,s.PrevInSEL=n,s.NextInSEL=a}else{var a=n.NextInSEL,u=n.PrevInSEL;n.NextInSEL=s.NextInSEL,n.NextInSEL!==null&&(n.NextInSEL.PrevInSEL=n),n.PrevInSEL=s.PrevInSEL,n.PrevInSEL!==null&&(n.PrevInSEL.NextInSEL=n),s.NextInSEL=a,s.NextInSEL!==null&&(s.NextInSEL.PrevInSEL=s),s.PrevInSEL=u,s.PrevInSEL!==null&&(s.PrevInSEL.NextInSEL=s)}n.PrevInSEL===null?this.m_SortedEdges=n:s.PrevInSEL===null&&(this.m_SortedEdges=s)}},i.Clipper.prototype.AddLocalMaxPoly=function(n,s,a){this.AddOutPt(n,a),s.WindDelta===0&&this.AddOutPt(s,a),n.OutIdx===s.OutIdx?(n.OutIdx=-1,s.OutIdx=-1):n.OutIdx<s.OutIdx?this.AppendPolygon(n,s):this.AppendPolygon(s,n)},i.Clipper.prototype.AddLocalMinPoly=function(n,s,a){var u,d,g;if(i.ClipperBase.IsHorizontal(s)||n.Dx>s.Dx?(u=this.AddOutPt(n,a),s.OutIdx=n.OutIdx,n.Side=i.EdgeSide.esLeft,s.Side=i.EdgeSide.esRight,d=n,d.PrevInAEL===s?g=s.PrevInAEL:g=d.PrevInAEL):(u=this.AddOutPt(s,a),n.OutIdx=s.OutIdx,n.Side=i.EdgeSide.esRight,s.Side=i.EdgeSide.esLeft,d=s,d.PrevInAEL===n?g=n.PrevInAEL:g=d.PrevInAEL),g!==null&&g.OutIdx>=0&&g.Top.Y<a.Y&&d.Top.Y<a.Y){var y=i.Clipper.TopX(g,a.Y),M=i.Clipper.TopX(d,a.Y);if(y===M&&d.WindDelta!==0&&g.WindDelta!==0&&i.ClipperBase.SlopesEqual5(new i.IntPoint2(y,a.Y),g.Top,new i.IntPoint2(M,a.Y),d.Top,this.m_UseFullRange)){var b=this.AddOutPt(g,a);this.AddJoin(u,b,d.Top)}}return u},i.Clipper.prototype.AddOutPt=function(n,s){if(n.OutIdx<0){var a=this.CreateOutRec();a.IsOpen=n.WindDelta===0;var u=new i.OutPt;return a.Pts=u,u.Idx=a.Idx,u.Pt.X=s.X,u.Pt.Y=s.Y,i.use_xyz&&(u.Pt.Z=s.Z),u.Next=u,u.Prev=u,a.IsOpen||this.SetHoleState(n,a),n.OutIdx=a.Idx,u}else{var a=this.m_PolyOuts[n.OutIdx],d=a.Pts,g=n.Side===i.EdgeSide.esLeft;if(g&&i.IntPoint.op_Equality(s,d.Pt))return d;if(!g&&i.IntPoint.op_Equality(s,d.Prev.Pt))return d.Prev;var u=new i.OutPt;return u.Idx=a.Idx,u.Pt.X=s.X,u.Pt.Y=s.Y,i.use_xyz&&(u.Pt.Z=s.Z),u.Next=d,u.Prev=d.Prev,u.Prev.Next=u,d.Prev=u,g&&(a.Pts=u),u}},i.Clipper.prototype.GetLastOutPt=function(n){var s=this.m_PolyOuts[n.OutIdx];return n.Side===i.EdgeSide.esLeft?s.Pts:s.Pts.Prev},i.Clipper.prototype.SwapPoints=function(n,s){var a=new i.IntPoint1(n.Value);n.Value.X=s.Value.X,n.Value.Y=s.Value.Y,i.use_xyz&&(n.Value.Z=s.Value.Z),s.Value.X=a.X,s.Value.Y=a.Y,i.use_xyz&&(s.Value.Z=a.Z)},i.Clipper.prototype.HorzSegmentsOverlap=function(n,s,a,u){var d;return n>s&&(d=n,n=s,s=d),a>u&&(d=a,a=u,u=d),n<u&&a<s},i.Clipper.prototype.SetHoleState=function(n,s){for(var a=n.PrevInAEL,u=null;a!==null;)a.OutIdx>=0&&a.WindDelta!==0&&(u===null?u=a:u.OutIdx===a.OutIdx&&(u=null)),a=a.PrevInAEL;u===null?(s.FirstLeft=null,s.IsHole=!1):(s.FirstLeft=this.m_PolyOuts[u.OutIdx],s.IsHole=!s.FirstLeft.IsHole)},i.Clipper.prototype.GetDx=function(n,s){return n.Y===s.Y?i.ClipperBase.horizontal:(s.X-n.X)/(s.Y-n.Y)},i.Clipper.prototype.FirstIsBottomPt=function(n,s){for(var a=n.Prev;i.IntPoint.op_Equality(a.Pt,n.Pt)&&a!==n;)a=a.Prev;var u=Math.abs(this.GetDx(n.Pt,a.Pt));for(a=n.Next;i.IntPoint.op_Equality(a.Pt,n.Pt)&&a!==n;)a=a.Next;var d=Math.abs(this.GetDx(n.Pt,a.Pt));for(a=s.Prev;i.IntPoint.op_Equality(a.Pt,s.Pt)&&a!==s;)a=a.Prev;var g=Math.abs(this.GetDx(s.Pt,a.Pt));for(a=s.Next;i.IntPoint.op_Equality(a.Pt,s.Pt)&&a!==s;)a=a.Next;var y=Math.abs(this.GetDx(s.Pt,a.Pt));return Math.max(u,d)===Math.max(g,y)&&Math.min(u,d)===Math.min(g,y)?this.Area(n)>0:u>=g&&u>=y||d>=g&&d>=y},i.Clipper.prototype.GetBottomPt=function(n){for(var s=null,a=n.Next;a!==n;)a.Pt.Y>n.Pt.Y?(n=a,s=null):a.Pt.Y===n.Pt.Y&&a.Pt.X<=n.Pt.X&&(a.Pt.X<n.Pt.X?(s=null,n=a):a.Next!==n&&a.Prev!==n&&(s=a)),a=a.Next;if(s!==null)for(;s!==a;)for(this.FirstIsBottomPt(a,s)||(n=s),s=s.Next;i.IntPoint.op_Inequality(s.Pt,n.Pt);)s=s.Next;return n},i.Clipper.prototype.GetLowermostRec=function(n,s){n.BottomPt===null&&(n.BottomPt=this.GetBottomPt(n.Pts)),s.BottomPt===null&&(s.BottomPt=this.GetBottomPt(s.Pts));var a=n.BottomPt,u=s.BottomPt;return a.Pt.Y>u.Pt.Y?n:a.Pt.Y<u.Pt.Y?s:a.Pt.X<u.Pt.X?n:a.Pt.X>u.Pt.X||a.Next===a?s:u.Next===u||this.FirstIsBottomPt(a,u)?n:s},i.Clipper.prototype.OutRec1RightOfOutRec2=function(n,s){do if(n=n.FirstLeft,n===s)return!0;while(n!==null);return!1},i.Clipper.prototype.GetOutRec=function(n){for(var s=this.m_PolyOuts[n];s!==this.m_PolyOuts[s.Idx];)s=this.m_PolyOuts[s.Idx];return s},i.Clipper.prototype.AppendPolygon=function(n,s){var a=this.m_PolyOuts[n.OutIdx],u=this.m_PolyOuts[s.OutIdx],d;this.OutRec1RightOfOutRec2(a,u)?d=u:this.OutRec1RightOfOutRec2(u,a)?d=a:d=this.GetLowermostRec(a,u);var g=a.Pts,y=g.Prev,M=u.Pts,b=M.Prev;n.Side===i.EdgeSide.esLeft?s.Side===i.EdgeSide.esLeft?(this.ReversePolyPtLinks(M),M.Next=g,g.Prev=M,y.Next=b,b.Prev=y,a.Pts=b):(b.Next=g,g.Prev=b,M.Prev=y,y.Next=M,a.Pts=M):s.Side===i.EdgeSide.esRight?(this.ReversePolyPtLinks(M),y.Next=b,b.Prev=y,M.Next=g,g.Prev=M):(y.Next=M,M.Prev=y,g.Prev=b,b.Next=g),a.BottomPt=null,d===u&&(u.FirstLeft!==a&&(a.FirstLeft=u.FirstLeft),a.IsHole=u.IsHole),u.Pts=null,u.BottomPt=null,u.FirstLeft=a;var A=n.OutIdx,L=s.OutIdx;n.OutIdx=-1,s.OutIdx=-1;for(var R=this.m_ActiveEdges;R!==null;){if(R.OutIdx===L){R.OutIdx=A,R.Side=n.Side;break}R=R.NextInAEL}u.Idx=a.Idx},i.Clipper.prototype.ReversePolyPtLinks=function(n){if(n!==null){var s,a;s=n;do a=s.Next,s.Next=s.Prev,s.Prev=a,s=a;while(s!==n)}},i.Clipper.SwapSides=function(n,s){var a=n.Side;n.Side=s.Side,s.Side=a},i.Clipper.SwapPolyIndexes=function(n,s){var a=n.OutIdx;n.OutIdx=s.OutIdx,s.OutIdx=a},i.Clipper.prototype.IntersectEdges=function(n,s,a){var u=n.OutIdx>=0,d=s.OutIdx>=0;if(i.use_xyz&&this.SetZ(a,n,s),i.use_lines&&(n.WindDelta===0||s.WindDelta===0)){if(n.WindDelta===0&&s.WindDelta===0)return;n.PolyTyp===s.PolyTyp&&n.WindDelta!==s.WindDelta&&this.m_ClipType===i.ClipType.ctUnion?n.WindDelta===0?d&&(this.AddOutPt(n,a),u&&(n.OutIdx=-1)):u&&(this.AddOutPt(s,a),d&&(s.OutIdx=-1)):n.PolyTyp!==s.PolyTyp&&(n.WindDelta===0&&Math.abs(s.WindCnt)===1&&(this.m_ClipType!==i.ClipType.ctUnion||s.WindCnt2===0)?(this.AddOutPt(n,a),u&&(n.OutIdx=-1)):s.WindDelta===0&&Math.abs(n.WindCnt)===1&&(this.m_ClipType!==i.ClipType.ctUnion||n.WindCnt2===0)&&(this.AddOutPt(s,a),d&&(s.OutIdx=-1)));return}if(n.PolyTyp===s.PolyTyp)if(this.IsEvenOddFillType(n)){var g=n.WindCnt;n.WindCnt=s.WindCnt,s.WindCnt=g}else n.WindCnt+s.WindDelta===0?n.WindCnt=-n.WindCnt:n.WindCnt+=s.WindDelta,s.WindCnt-n.WindDelta===0?s.WindCnt=-s.WindCnt:s.WindCnt-=n.WindDelta;else this.IsEvenOddFillType(s)?n.WindCnt2=n.WindCnt2===0?1:0:n.WindCnt2+=s.WindDelta,this.IsEvenOddFillType(n)?s.WindCnt2=s.WindCnt2===0?1:0:s.WindCnt2-=n.WindDelta;var y,M,b,A;n.PolyTyp===i.PolyType.ptSubject?(y=this.m_SubjFillType,b=this.m_ClipFillType):(y=this.m_ClipFillType,b=this.m_SubjFillType),s.PolyTyp===i.PolyType.ptSubject?(M=this.m_SubjFillType,A=this.m_ClipFillType):(M=this.m_ClipFillType,A=this.m_SubjFillType);var L,R;switch(y){case i.PolyFillType.pftPositive:L=n.WindCnt;break;case i.PolyFillType.pftNegative:L=-n.WindCnt;break;default:L=Math.abs(n.WindCnt);break}switch(M){case i.PolyFillType.pftPositive:R=s.WindCnt;break;case i.PolyFillType.pftNegative:R=-s.WindCnt;break;default:R=Math.abs(s.WindCnt);break}if(u&&d)L!==0&&L!==1||R!==0&&R!==1||n.PolyTyp!==s.PolyTyp&&this.m_ClipType!==i.ClipType.ctXor?this.AddLocalMaxPoly(n,s,a):(this.AddOutPt(n,a),this.AddOutPt(s,a),i.Clipper.SwapSides(n,s),i.Clipper.SwapPolyIndexes(n,s));else if(u)(R===0||R===1)&&(this.AddOutPt(n,a),i.Clipper.SwapSides(n,s),i.Clipper.SwapPolyIndexes(n,s));else if(d)(L===0||L===1)&&(this.AddOutPt(s,a),i.Clipper.SwapSides(n,s),i.Clipper.SwapPolyIndexes(n,s));else if((L===0||L===1)&&(R===0||R===1)){var F,G;switch(b){case i.PolyFillType.pftPositive:F=n.WindCnt2;break;case i.PolyFillType.pftNegative:F=-n.WindCnt2;break;default:F=Math.abs(n.WindCnt2);break}switch(A){case i.PolyFillType.pftPositive:G=s.WindCnt2;break;case i.PolyFillType.pftNegative:G=-s.WindCnt2;break;default:G=Math.abs(s.WindCnt2);break}if(n.PolyTyp!==s.PolyTyp)this.AddLocalMinPoly(n,s,a);else if(L===1&&R===1)switch(this.m_ClipType){case i.ClipType.ctIntersection:F>0&&G>0&&this.AddLocalMinPoly(n,s,a);break;case i.ClipType.ctUnion:F<=0&&G<=0&&this.AddLocalMinPoly(n,s,a);break;case i.ClipType.ctDifference:(n.PolyTyp===i.PolyType.ptClip&&F>0&&G>0||n.PolyTyp===i.PolyType.ptSubject&&F<=0&&G<=0)&&this.AddLocalMinPoly(n,s,a);break;case i.ClipType.ctXor:this.AddLocalMinPoly(n,s,a);break}else i.Clipper.SwapSides(n,s)}},i.Clipper.prototype.DeleteFromSEL=function(n){var s=n.PrevInSEL,a=n.NextInSEL;s===null&&a===null&&n!==this.m_SortedEdges||(s!==null?s.NextInSEL=a:this.m_SortedEdges=a,a!==null&&(a.PrevInSEL=s),n.NextInSEL=null,n.PrevInSEL=null)},i.Clipper.prototype.ProcessHorizontals=function(){for(var n={};this.PopEdgeFromSEL(n);)this.ProcessHorizontal(n.v)},i.Clipper.prototype.GetHorzDirection=function(n,s){n.Bot.X<n.Top.X?(s.Left=n.Bot.X,s.Right=n.Top.X,s.Dir=i.Direction.dLeftToRight):(s.Left=n.Top.X,s.Right=n.Bot.X,s.Dir=i.Direction.dRightToLeft)},i.Clipper.prototype.ProcessHorizontal=function(n){var s={Dir:null,Left:null,Right:null};this.GetHorzDirection(n,s);for(var a=s.Dir,u=s.Left,d=s.Right,g=n.WindDelta===0,y=n,M=null;y.NextInLML!==null&&i.ClipperBase.IsHorizontal(y.NextInLML);)y=y.NextInLML;y.NextInLML===null&&(M=this.GetMaximaPair(y));var b=this.m_Maxima;if(b!==null)if(a===i.Direction.dLeftToRight){for(;b!==null&&b.X<=n.Bot.X;)b=b.Next;b!==null&&b.X>=y.Top.X&&(b=null)}else{for(;b.Next!==null&&b.Next.X<n.Bot.X;)b=b.Next;b.X<=y.Top.X&&(b=null)}for(var A=null;;){for(var L=n===y,R=this.GetNextInAEL(n,a);R!==null;){if(b!==null)if(a===i.Direction.dLeftToRight)for(;b!==null&&b.X<R.Curr.X;)n.OutIdx>=0&&!g&&this.AddOutPt(n,new i.IntPoint2(b.X,n.Bot.Y)),b=b.Next;else for(;b!==null&&b.X>R.Curr.X;)n.OutIdx>=0&&!g&&this.AddOutPt(n,new i.IntPoint2(b.X,n.Bot.Y)),b=b.Prev;if(a===i.Direction.dLeftToRight&&R.Curr.X>d||a===i.Direction.dRightToLeft&&R.Curr.X<u||R.Curr.X===n.Top.X&&n.NextInLML!==null&&R.Dx<n.NextInLML.Dx)break;if(n.OutIdx>=0&&!g){i.use_xyz&&(a===i.Direction.dLeftToRight?this.SetZ(R.Curr,n,R):this.SetZ(R.Curr,R,n)),A=this.AddOutPt(n,R.Curr);for(var F=this.m_SortedEdges;F!==null;){if(F.OutIdx>=0&&this.HorzSegmentsOverlap(n.Bot.X,n.Top.X,F.Bot.X,F.Top.X)){var G=this.GetLastOutPt(F);this.AddJoin(G,A,F.Top)}F=F.NextInSEL}this.AddGhostJoin(A,n.Bot)}if(R===M&&L){n.OutIdx>=0&&this.AddLocalMaxPoly(n,M,n.Top),this.DeleteFromAEL(n),this.DeleteFromAEL(M);return}if(a===i.Direction.dLeftToRight){var J=new i.IntPoint2(R.Curr.X,n.Curr.Y);this.IntersectEdges(n,R,J)}else{var J=new i.IntPoint2(R.Curr.X,n.Curr.Y);this.IntersectEdges(R,n,J)}var K=this.GetNextInAEL(R,a);this.SwapPositionsInAEL(n,R),R=K}if(n.NextInLML===null||!i.ClipperBase.IsHorizontal(n.NextInLML))break;n=this.UpdateEdgeIntoAEL(n),n.OutIdx>=0&&this.AddOutPt(n,n.Bot),s={Dir:a,Left:u,Right:d},this.GetHorzDirection(n,s),a=s.Dir,u=s.Left,d=s.Right}if(n.OutIdx>=0&&A===null){A=this.GetLastOutPt(n);for(var F=this.m_SortedEdges;F!==null;){if(F.OutIdx>=0&&this.HorzSegmentsOverlap(n.Bot.X,n.Top.X,F.Bot.X,F.Top.X)){var G=this.GetLastOutPt(F);this.AddJoin(G,A,F.Top)}F=F.NextInSEL}this.AddGhostJoin(A,n.Top)}if(n.NextInLML!==null)if(n.OutIdx>=0){if(A=this.AddOutPt(n,n.Top),n=this.UpdateEdgeIntoAEL(n),n.WindDelta===0)return;var nt=n.PrevInAEL,K=n.NextInAEL;if(nt!==null&&nt.Curr.X===n.Bot.X&&nt.Curr.Y===n.Bot.Y&&nt.WindDelta===0&&nt.OutIdx>=0&&nt.Curr.Y>nt.Top.Y&&i.ClipperBase.SlopesEqual3(n,nt,this.m_UseFullRange)){var G=this.AddOutPt(nt,n.Bot);this.AddJoin(A,G,n.Top)}else if(K!==null&&K.Curr.X===n.Bot.X&&K.Curr.Y===n.Bot.Y&&K.WindDelta!==0&&K.OutIdx>=0&&K.Curr.Y>K.Top.Y&&i.ClipperBase.SlopesEqual3(n,K,this.m_UseFullRange)){var G=this.AddOutPt(K,n.Bot);this.AddJoin(A,G,n.Top)}}else n=this.UpdateEdgeIntoAEL(n);else n.OutIdx>=0&&this.AddOutPt(n,n.Top),this.DeleteFromAEL(n)},i.Clipper.prototype.GetNextInAEL=function(n,s){return s===i.Direction.dLeftToRight?n.NextInAEL:n.PrevInAEL},i.Clipper.prototype.IsMinima=function(n){return n!==null&&n.Prev.NextInLML!==n&&n.Next.NextInLML!==n},i.Clipper.prototype.IsMaxima=function(n,s){return n!==null&&n.Top.Y===s&&n.NextInLML===null},i.Clipper.prototype.IsIntermediate=function(n,s){return n.Top.Y===s&&n.NextInLML!==null},i.Clipper.prototype.GetMaximaPair=function(n){return i.IntPoint.op_Equality(n.Next.Top,n.Top)&&n.Next.NextInLML===null?n.Next:i.IntPoint.op_Equality(n.Prev.Top,n.Top)&&n.Prev.NextInLML===null?n.Prev:null},i.Clipper.prototype.GetMaximaPairEx=function(n){var s=this.GetMaximaPair(n);return s===null||s.OutIdx===i.ClipperBase.Skip||s.NextInAEL===s.PrevInAEL&&!i.ClipperBase.IsHorizontal(s)?null:s},i.Clipper.prototype.ProcessIntersections=function(n){if(this.m_ActiveEdges===null)return!0;try{if(this.BuildIntersectList(n),this.m_IntersectList.length===0)return!0;if(this.m_IntersectList.length===1||this.FixupIntersectionOrder())this.ProcessIntersectList();else return!1}catch{this.m_SortedEdges=null,this.m_IntersectList.length=0,i.Error("ProcessIntersections error")}return this.m_SortedEdges=null,!0},i.Clipper.prototype.BuildIntersectList=function(n){if(this.m_ActiveEdges!==null){var s=this.m_ActiveEdges;for(this.m_SortedEdges=s;s!==null;)s.PrevInSEL=s.PrevInAEL,s.NextInSEL=s.NextInAEL,s.Curr.X=i.Clipper.TopX(s,n),s=s.NextInAEL;for(var a=!0;a&&this.m_SortedEdges!==null;){for(a=!1,s=this.m_SortedEdges;s.NextInSEL!==null;){var u=s.NextInSEL,d=new i.IntPoint0;if(s.Curr.X>u.Curr.X){this.IntersectPoint(s,u,d),d.Y<n&&(d=new i.IntPoint2(i.Clipper.TopX(s,n),n));var g=new i.IntersectNode;g.Edge1=s,g.Edge2=u,g.Pt.X=d.X,g.Pt.Y=d.Y,i.use_xyz&&(g.Pt.Z=d.Z),this.m_IntersectList.push(g),this.SwapPositionsInSEL(s,u),a=!0}else s=u}if(s.PrevInSEL!==null)s.PrevInSEL.NextInSEL=null;else break}this.m_SortedEdges=null}},i.Clipper.prototype.EdgesAdjacent=function(n){return n.Edge1.NextInSEL===n.Edge2||n.Edge1.PrevInSEL===n.Edge2},i.Clipper.IntersectNodeSort=function(n,s){return s.Pt.Y-n.Pt.Y},i.Clipper.prototype.FixupIntersectionOrder=function(){this.m_IntersectList.sort(this.m_IntersectNodeComparer),this.CopyAELToSEL();for(var n=this.m_IntersectList.length,s=0;s<n;s++){if(!this.EdgesAdjacent(this.m_IntersectList[s])){for(var a=s+1;a<n&&!this.EdgesAdjacent(this.m_IntersectList[a]);)a++;if(a===n)return!1;var u=this.m_IntersectList[s];this.m_IntersectList[s]=this.m_IntersectList[a],this.m_IntersectList[a]=u}this.SwapPositionsInSEL(this.m_IntersectList[s].Edge1,this.m_IntersectList[s].Edge2)}return!0},i.Clipper.prototype.ProcessIntersectList=function(){for(var n=0,s=this.m_IntersectList.length;n<s;n++){var a=this.m_IntersectList[n];this.IntersectEdges(a.Edge1,a.Edge2,a.Pt),this.SwapPositionsInAEL(a.Edge1,a.Edge2)}this.m_IntersectList.length=0};var jl=function(n){return n<0?Math.ceil(n-.5):Math.round(n)},Ql=function(n){return n<0?Math.ceil(n-.5):Math.floor(n+.5)},tc=function(n){return n<0?-Math.round(Math.abs(n)):Math.round(n)},ec=function(n){return n<0?(n-=.5,n<-2147483648?Math.ceil(n):n|0):(n+=.5,n>2147483647?Math.floor(n):n|0)};o.msie?i.Clipper.Round=jl:o.chromium?i.Clipper.Round=tc:o.safari?i.Clipper.Round=ec:i.Clipper.Round=Ql,i.Clipper.TopX=function(n,s){return s===n.Top.Y?n.Top.X:n.Bot.X+i.Clipper.Round(n.Dx*(s-n.Bot.Y))},i.Clipper.prototype.IntersectPoint=function(n,s,a){a.X=0,a.Y=0;var u,d;if(n.Dx===s.Dx){a.Y=n.Curr.Y,a.X=i.Clipper.TopX(n,a.Y);return}if(n.Delta.X===0)a.X=n.Bot.X,i.ClipperBase.IsHorizontal(s)?a.Y=s.Bot.Y:(d=s.Bot.Y-s.Bot.X/s.Dx,a.Y=i.Clipper.Round(a.X/s.Dx+d));else if(s.Delta.X===0)a.X=s.Bot.X,i.ClipperBase.IsHorizontal(n)?a.Y=n.Bot.Y:(u=n.Bot.Y-n.Bot.X/n.Dx,a.Y=i.Clipper.Round(a.X/n.Dx+u));else{u=n.Bot.X-n.Bot.Y*n.Dx,d=s.Bot.X-s.Bot.Y*s.Dx;var g=(d-u)/(n.Dx-s.Dx);a.Y=i.Clipper.Round(g),Math.abs(n.Dx)<Math.abs(s.Dx)?a.X=i.Clipper.Round(n.Dx*g+u):a.X=i.Clipper.Round(s.Dx*g+d)}if(a.Y<n.Top.Y||a.Y<s.Top.Y){if(n.Top.Y>s.Top.Y)return a.Y=n.Top.Y,a.X=i.Clipper.TopX(s,n.Top.Y),a.X<n.Top.X;a.Y=s.Top.Y,Math.abs(n.Dx)<Math.abs(s.Dx)?a.X=i.Clipper.TopX(n,a.Y):a.X=i.Clipper.TopX(s,a.Y)}a.Y>n.Curr.Y&&(a.Y=n.Curr.Y,Math.abs(n.Dx)>Math.abs(s.Dx)?a.X=i.Clipper.TopX(s,a.Y):a.X=i.Clipper.TopX(n,a.Y))},i.Clipper.prototype.ProcessEdgesAtTopOfScanbeam=function(n){for(var s=this.m_ActiveEdges;s!==null;){var a=this.IsMaxima(s,n);if(a){var u=this.GetMaximaPairEx(s);a=u===null||!i.ClipperBase.IsHorizontal(u)}if(a){this.StrictlySimple&&this.InsertMaxima(s.Top.X);var d=s.PrevInAEL;this.DoMaxima(s),d===null?s=this.m_ActiveEdges:s=d.NextInAEL}else{if(this.IsIntermediate(s,n)&&i.ClipperBase.IsHorizontal(s.NextInLML)?(s=this.UpdateEdgeIntoAEL(s),s.OutIdx>=0&&this.AddOutPt(s,s.Bot),this.AddEdgeToSEL(s)):(s.Curr.X=i.Clipper.TopX(s,n),s.Curr.Y=n),i.use_xyz&&(s.Top.Y===n?s.Curr.Z=s.Top.Z:s.Bot.Y===n?s.Curr.Z=s.Bot.Z:s.Curr.Z=0),this.StrictlySimple){var d=s.PrevInAEL;if(s.OutIdx>=0&&s.WindDelta!==0&&d!==null&&d.OutIdx>=0&&d.Curr.X===s.Curr.X&&d.WindDelta!==0){var g=new i.IntPoint1(s.Curr);i.use_xyz&&this.SetZ(g,d,s);var y=this.AddOutPt(d,g),M=this.AddOutPt(s,g);this.AddJoin(y,M,g)}}s=s.NextInAEL}}for(this.ProcessHorizontals(),this.m_Maxima=null,s=this.m_ActiveEdges;s!==null;){if(this.IsIntermediate(s,n)){var y=null;s.OutIdx>=0&&(y=this.AddOutPt(s,s.Top)),s=this.UpdateEdgeIntoAEL(s);var d=s.PrevInAEL,b=s.NextInAEL;if(d!==null&&d.Curr.X===s.Bot.X&&d.Curr.Y===s.Bot.Y&&y!==null&&d.OutIdx>=0&&d.Curr.Y===d.Top.Y&&i.ClipperBase.SlopesEqual5(s.Curr,s.Top,d.Curr,d.Top,this.m_UseFullRange)&&s.WindDelta!==0&&d.WindDelta!==0){var M=this.AddOutPt(ePrev2,s.Bot);this.AddJoin(y,M,s.Top)}else if(b!==null&&b.Curr.X===s.Bot.X&&b.Curr.Y===s.Bot.Y&&y!==null&&b.OutIdx>=0&&b.Curr.Y===b.Top.Y&&i.ClipperBase.SlopesEqual5(s.Curr,s.Top,b.Curr,b.Top,this.m_UseFullRange)&&s.WindDelta!==0&&b.WindDelta!==0){var M=this.AddOutPt(b,s.Bot);this.AddJoin(y,M,s.Top)}}s=s.NextInAEL}},i.Clipper.prototype.DoMaxima=function(n){var s=this.GetMaximaPairEx(n);if(s===null){n.OutIdx>=0&&this.AddOutPt(n,n.Top),this.DeleteFromAEL(n);return}for(var a=n.NextInAEL;a!==null&&a!==s;)this.IntersectEdges(n,a,n.Top),this.SwapPositionsInAEL(n,a),a=n.NextInAEL;n.OutIdx===-1&&s.OutIdx===-1?(this.DeleteFromAEL(n),this.DeleteFromAEL(s)):n.OutIdx>=0&&s.OutIdx>=0?(n.OutIdx>=0&&this.AddLocalMaxPoly(n,s,n.Top),this.DeleteFromAEL(n),this.DeleteFromAEL(s)):i.use_lines&&n.WindDelta===0?(n.OutIdx>=0&&(this.AddOutPt(n,n.Top),n.OutIdx=i.ClipperBase.Unassigned),this.DeleteFromAEL(n),s.OutIdx>=0&&(this.AddOutPt(s,n.Top),s.OutIdx=i.ClipperBase.Unassigned),this.DeleteFromAEL(s)):i.Error("DoMaxima error")},i.Clipper.ReversePaths=function(n){for(var s=0,a=n.length;s<a;s++)n[s].reverse()},i.Clipper.Orientation=function(n){return i.Clipper.Area(n)>=0},i.Clipper.prototype.PointCount=function(n){if(n===null)return 0;var s=0,a=n;do s++,a=a.Next;while(a!==n);return s},i.Clipper.prototype.BuildResult=function(n){i.Clear(n);for(var s=0,a=this.m_PolyOuts.length;s<a;s++){var u=this.m_PolyOuts[s];if(u.Pts!==null){var d=u.Pts.Prev,g=this.PointCount(d);if(!(g<2)){for(var y=new Array(g),M=0;M<g;M++)y[M]=d.Pt,d=d.Prev;n.push(y)}}}},i.Clipper.prototype.BuildResult2=function(n){n.Clear();for(var s=0,a=this.m_PolyOuts.length;s<a;s++){var u=this.m_PolyOuts[s],d=this.PointCount(u.Pts);if(!(u.IsOpen&&d<2||!u.IsOpen&&d<3)){this.FixHoleLinkage(u);var g=new i.PolyNode;n.m_AllPolys.push(g),u.PolyNode=g,g.m_polygon.length=d;for(var y=u.Pts.Prev,M=0;M<d;M++)g.m_polygon[M]=y.Pt,y=y.Prev}}for(var s=0,a=this.m_PolyOuts.length;s<a;s++){var u=this.m_PolyOuts[s];u.PolyNode!==null&&(u.IsOpen?(u.PolyNode.IsOpen=!0,n.AddChild(u.PolyNode)):u.FirstLeft!==null&&u.FirstLeft.PolyNode!==null?u.FirstLeft.PolyNode.AddChild(u.PolyNode):n.AddChild(u.PolyNode))}},i.Clipper.prototype.FixupOutPolyline=function(n){for(var s=n.Pts,a=s.Prev;s!==a;)if(s=s.Next,i.IntPoint.op_Equality(s.Pt,s.Prev.Pt)){s===a&&(a=s.Prev);var u=s.Prev;u.Next=s.Next,s.Next.Prev=u,s=u}s===s.Prev&&(n.Pts=null)},i.Clipper.prototype.FixupOutPolygon=function(n){var s=null;n.BottomPt=null;for(var a=n.Pts,u=this.PreserveCollinear||this.StrictlySimple;;){if(a.Prev===a||a.Prev===a.Next){n.Pts=null;return}if(i.IntPoint.op_Equality(a.Pt,a.Next.Pt)||i.IntPoint.op_Equality(a.Pt,a.Prev.Pt)||i.ClipperBase.SlopesEqual4(a.Prev.Pt,a.Pt,a.Next.Pt,this.m_UseFullRange)&&(!u||!this.Pt2IsBetweenPt1AndPt3(a.Prev.Pt,a.Pt,a.Next.Pt)))s=null,a.Prev.Next=a.Next,a.Next.Prev=a.Prev,a=a.Prev;else{if(a===s)break;s===null&&(s=a),a=a.Next}}n.Pts=a},i.Clipper.prototype.DupOutPt=function(n,s){var a=new i.OutPt;return a.Pt.X=n.Pt.X,a.Pt.Y=n.Pt.Y,i.use_xyz&&(a.Pt.Z=n.Pt.Z),a.Idx=n.Idx,s?(a.Next=n.Next,a.Prev=n,n.Next.Prev=a,n.Next=a):(a.Prev=n.Prev,a.Next=n,n.Prev.Next=a,n.Prev=a),a},i.Clipper.prototype.GetOverlap=function(n,s,a,u,d){return n<s?a<u?(d.Left=Math.max(n,a),d.Right=Math.min(s,u)):(d.Left=Math.max(n,u),d.Right=Math.min(s,a)):a<u?(d.Left=Math.max(s,a),d.Right=Math.min(n,u)):(d.Left=Math.max(s,u),d.Right=Math.min(n,a)),d.Left<d.Right},i.Clipper.prototype.JoinHorz=function(n,s,a,u,d,g){var y=n.Pt.X>s.Pt.X?i.Direction.dRightToLeft:i.Direction.dLeftToRight,M=a.Pt.X>u.Pt.X?i.Direction.dRightToLeft:i.Direction.dLeftToRight;if(y===M)return!1;if(y===i.Direction.dLeftToRight){for(;n.Next.Pt.X<=d.X&&n.Next.Pt.X>=n.Pt.X&&n.Next.Pt.Y===d.Y;)n=n.Next;g&&n.Pt.X!==d.X&&(n=n.Next),s=this.DupOutPt(n,!g),i.IntPoint.op_Inequality(s.Pt,d)&&(n=s,n.Pt.X=d.X,n.Pt.Y=d.Y,i.use_xyz&&(n.Pt.Z=d.Z),s=this.DupOutPt(n,!g))}else{for(;n.Next.Pt.X>=d.X&&n.Next.Pt.X<=n.Pt.X&&n.Next.Pt.Y===d.Y;)n=n.Next;!g&&n.Pt.X!==d.X&&(n=n.Next),s=this.DupOutPt(n,g),i.IntPoint.op_Inequality(s.Pt,d)&&(n=s,n.Pt.X=d.X,n.Pt.Y=d.Y,i.use_xyz&&(n.Pt.Z=d.Z),s=this.DupOutPt(n,g))}if(M===i.Direction.dLeftToRight){for(;a.Next.Pt.X<=d.X&&a.Next.Pt.X>=a.Pt.X&&a.Next.Pt.Y===d.Y;)a=a.Next;g&&a.Pt.X!==d.X&&(a=a.Next),u=this.DupOutPt(a,!g),i.IntPoint.op_Inequality(u.Pt,d)&&(a=u,a.Pt.X=d.X,a.Pt.Y=d.Y,i.use_xyz&&(a.Pt.Z=d.Z),u=this.DupOutPt(a,!g))}else{for(;a.Next.Pt.X>=d.X&&a.Next.Pt.X<=a.Pt.X&&a.Next.Pt.Y===d.Y;)a=a.Next;!g&&a.Pt.X!==d.X&&(a=a.Next),u=this.DupOutPt(a,g),i.IntPoint.op_Inequality(u.Pt,d)&&(a=u,a.Pt.X=d.X,a.Pt.Y=d.Y,i.use_xyz&&(a.Pt.Z=d.Z),u=this.DupOutPt(a,g))}return y===i.Direction.dLeftToRight===g?(n.Prev=a,a.Next=n,s.Next=u,u.Prev=s):(n.Next=a,a.Prev=n,s.Prev=u,u.Next=s),!0},i.Clipper.prototype.JoinPoints=function(n,s,a){var u=n.OutPt1,d=new i.OutPt,g=n.OutPt2,y=new i.OutPt,M=n.OutPt1.Pt.Y===n.OffPt.Y;if(M&&i.IntPoint.op_Equality(n.OffPt,n.OutPt1.Pt)&&i.IntPoint.op_Equality(n.OffPt,n.OutPt2.Pt)){if(s!==a)return!1;for(d=n.OutPt1.Next;d!==u&&i.IntPoint.op_Equality(d.Pt,n.OffPt);)d=d.Next;var b=d.Pt.Y>n.OffPt.Y;for(y=n.OutPt2.Next;y!==g&&i.IntPoint.op_Equality(y.Pt,n.OffPt);)y=y.Next;var A=y.Pt.Y>n.OffPt.Y;return b===A?!1:b?(d=this.DupOutPt(u,!1),y=this.DupOutPt(g,!0),u.Prev=g,g.Next=u,d.Next=y,y.Prev=d,n.OutPt1=u,n.OutPt2=d,!0):(d=this.DupOutPt(u,!0),y=this.DupOutPt(g,!1),u.Next=g,g.Prev=u,d.Prev=y,y.Next=d,n.OutPt1=u,n.OutPt2=d,!0)}else if(M){for(d=u;u.Prev.Pt.Y===u.Pt.Y&&u.Prev!==d&&u.Prev!==g;)u=u.Prev;for(;d.Next.Pt.Y===d.Pt.Y&&d.Next!==u&&d.Next!==g;)d=d.Next;if(d.Next===u||d.Next===g)return!1;for(y=g;g.Prev.Pt.Y===g.Pt.Y&&g.Prev!==y&&g.Prev!==d;)g=g.Prev;for(;y.Next.Pt.Y===y.Pt.Y&&y.Next!==g&&y.Next!==u;)y=y.Next;if(y.Next===g||y.Next===u)return!1;var L={Left:null,Right:null};if(!this.GetOverlap(u.Pt.X,d.Pt.X,g.Pt.X,y.Pt.X,L))return!1;var R=L.Left,F=L.Right,G=new i.IntPoint0,J;return u.Pt.X>=R&&u.Pt.X<=F?(G.X=u.Pt.X,G.Y=u.Pt.Y,i.use_xyz&&(G.Z=u.Pt.Z),J=u.Pt.X>d.Pt.X):g.Pt.X>=R&&g.Pt.X<=F?(G.X=g.Pt.X,G.Y=g.Pt.Y,i.use_xyz&&(G.Z=g.Pt.Z),J=g.Pt.X>y.Pt.X):d.Pt.X>=R&&d.Pt.X<=F?(G.X=d.Pt.X,G.Y=d.Pt.Y,i.use_xyz&&(G.Z=d.Pt.Z),J=d.Pt.X>u.Pt.X):(G.X=y.Pt.X,G.Y=y.Pt.Y,i.use_xyz&&(G.Z=y.Pt.Z),J=y.Pt.X>g.Pt.X),n.OutPt1=u,n.OutPt2=g,this.JoinHorz(u,d,g,y,G,J)}else{for(d=u.Next;i.IntPoint.op_Equality(d.Pt,u.Pt)&&d!==u;)d=d.Next;var K=d.Pt.Y>u.Pt.Y||!i.ClipperBase.SlopesEqual4(u.Pt,d.Pt,n.OffPt,this.m_UseFullRange);if(K){for(d=u.Prev;i.IntPoint.op_Equality(d.Pt,u.Pt)&&d!==u;)d=d.Prev;if(d.Pt.Y>u.Pt.Y||!i.ClipperBase.SlopesEqual4(u.Pt,d.Pt,n.OffPt,this.m_UseFullRange))return!1}for(y=g.Next;i.IntPoint.op_Equality(y.Pt,g.Pt)&&y!==g;)y=y.Next;var nt=y.Pt.Y>g.Pt.Y||!i.ClipperBase.SlopesEqual4(g.Pt,y.Pt,n.OffPt,this.m_UseFullRange);if(nt){for(y=g.Prev;i.IntPoint.op_Equality(y.Pt,g.Pt)&&y!==g;)y=y.Prev;if(y.Pt.Y>g.Pt.Y||!i.ClipperBase.SlopesEqual4(g.Pt,y.Pt,n.OffPt,this.m_UseFullRange))return!1}return d===u||y===g||d===y||s===a&&K===nt?!1:K?(d=this.DupOutPt(u,!1),y=this.DupOutPt(g,!0),u.Prev=g,g.Next=u,d.Next=y,y.Prev=d,n.OutPt1=u,n.OutPt2=d,!0):(d=this.DupOutPt(u,!0),y=this.DupOutPt(g,!1),u.Next=g,g.Prev=u,d.Prev=y,y.Next=d,n.OutPt1=u,n.OutPt2=d,!0)}},i.Clipper.GetBounds=function(n){for(var s=0,a=n.length;s<a&&n[s].length===0;)s++;if(s===a)return new i.IntRect(0,0,0,0);var u=new i.IntRect;for(u.left=n[s][0].X,u.right=u.left,u.top=n[s][0].Y,u.bottom=u.top;s<a;s++)for(var d=0,g=n[s].length;d<g;d++)n[s][d].X<u.left?u.left=n[s][d].X:n[s][d].X>u.right&&(u.right=n[s][d].X),n[s][d].Y<u.top?u.top=n[s][d].Y:n[s][d].Y>u.bottom&&(u.bottom=n[s][d].Y);return u},i.Clipper.prototype.GetBounds2=function(n){var s=n,a=new i.IntRect;for(a.left=n.Pt.X,a.right=n.Pt.X,a.top=n.Pt.Y,a.bottom=n.Pt.Y,n=n.Next;n!==s;)n.Pt.X<a.left&&(a.left=n.Pt.X),n.Pt.X>a.right&&(a.right=n.Pt.X),n.Pt.Y<a.top&&(a.top=n.Pt.Y),n.Pt.Y>a.bottom&&(a.bottom=n.Pt.Y),n=n.Next;return a},i.Clipper.PointInPolygon=function(n,s){var a=0,u=s.length;if(u<3)return 0;for(var d=s[0],g=1;g<=u;++g){var y=g===u?s[0]:s[g];if(y.Y===n.Y&&(y.X===n.X||d.Y===n.Y&&y.X>n.X==d.X<n.X))return-1;if(d.Y<n.Y!=y.Y<n.Y){if(d.X>=n.X)if(y.X>n.X)a=1-a;else{var M=(d.X-n.X)*(y.Y-n.Y)-(y.X-n.X)*(d.Y-n.Y);if(M===0)return-1;M>0==y.Y>d.Y&&(a=1-a)}else if(y.X>n.X){var M=(d.X-n.X)*(y.Y-n.Y)-(y.X-n.X)*(d.Y-n.Y);if(M===0)return-1;M>0==y.Y>d.Y&&(a=1-a)}}d=y}return a},i.Clipper.prototype.PointInPolygon=function(n,s){var a=0,u=s,d=n.X,g=n.Y,y=s.Pt.X,M=s.Pt.Y;do{s=s.Next;var b=s.Pt.X,A=s.Pt.Y;if(A===g&&(b===d||M===g&&b>d==y<d))return-1;if(M<g!=A<g){if(y>=d)if(b>d)a=1-a;else{var L=(y-d)*(A-g)-(b-d)*(M-g);if(L===0)return-1;L>0==A>M&&(a=1-a)}else if(b>d){var L=(y-d)*(A-g)-(b-d)*(M-g);if(L===0)return-1;L>0==A>M&&(a=1-a)}}y=b,M=A}while(u!==s);return a},i.Clipper.prototype.Poly2ContainsPoly1=function(n,s){var a=n;do{var u=this.PointInPolygon(a.Pt,s);if(u>=0)return u>0;a=a.Next}while(a!==n);return!0},i.Clipper.prototype.FixupFirstLefts1=function(n,s){for(var a,u,d=0,g=this.m_PolyOuts.length;d<g;d++)a=this.m_PolyOuts[d],u=i.Clipper.ParseFirstLeft(a.FirstLeft),a.Pts!==null&&u===n&&this.Poly2ContainsPoly1(a.Pts,s.Pts)&&(a.FirstLeft=s)},i.Clipper.prototype.FixupFirstLefts2=function(n,s){for(var a=s.FirstLeft,u,d,g=0,y=this.m_PolyOuts.length;g<y;g++)u=this.m_PolyOuts[g],!(u.Pts===null||u===s||u===n)&&(d=i.Clipper.ParseFirstLeft(u.FirstLeft),!(d!==a&&d!==n&&d!==s)&&(this.Poly2ContainsPoly1(u.Pts,n.Pts)?u.FirstLeft=n:this.Poly2ContainsPoly1(u.Pts,s.Pts)?u.FirstLeft=s:(u.FirstLeft===n||u.FirstLeft===s)&&(u.FirstLeft=a)))},i.Clipper.prototype.FixupFirstLefts3=function(n,s){for(var a,u,d=0,g=this.m_PolyOuts.length;d<g;d++)a=this.m_PolyOuts[d],u=i.Clipper.ParseFirstLeft(a.FirstLeft),a.Pts!==null&&u===n&&(a.FirstLeft=s)},i.Clipper.ParseFirstLeft=function(n){for(;n!==null&&n.Pts===null;)n=n.FirstLeft;return n},i.Clipper.prototype.JoinCommonEdges=function(){for(var n=0,s=this.m_Joins.length;n<s;n++){var a=this.m_Joins[n],u=this.GetOutRec(a.OutPt1.Idx),d=this.GetOutRec(a.OutPt2.Idx);if(!(u.Pts===null||d.Pts===null)&&!(u.IsOpen||d.IsOpen)){var g;u===d?g=u:this.OutRec1RightOfOutRec2(u,d)?g=d:this.OutRec1RightOfOutRec2(d,u)?g=u:g=this.GetLowermostRec(u,d),this.JoinPoints(a,u,d)&&(u===d?(u.Pts=a.OutPt1,u.BottomPt=null,d=this.CreateOutRec(),d.Pts=a.OutPt2,this.UpdateOutPtIdxs(d),this.Poly2ContainsPoly1(d.Pts,u.Pts)?(d.IsHole=!u.IsHole,d.FirstLeft=u,this.m_UsingPolyTree&&this.FixupFirstLefts2(d,u),(d.IsHole^this.ReverseSolution)==this.Area$1(d)>0&&this.ReversePolyPtLinks(d.Pts)):this.Poly2ContainsPoly1(u.Pts,d.Pts)?(d.IsHole=u.IsHole,u.IsHole=!d.IsHole,d.FirstLeft=u.FirstLeft,u.FirstLeft=d,this.m_UsingPolyTree&&this.FixupFirstLefts2(u,d),(u.IsHole^this.ReverseSolution)==this.Area$1(u)>0&&this.ReversePolyPtLinks(u.Pts)):(d.IsHole=u.IsHole,d.FirstLeft=u.FirstLeft,this.m_UsingPolyTree&&this.FixupFirstLefts1(u,d))):(d.Pts=null,d.BottomPt=null,d.Idx=u.Idx,u.IsHole=g.IsHole,g===d&&(u.FirstLeft=d.FirstLeft),d.FirstLeft=u,this.m_UsingPolyTree&&this.FixupFirstLefts3(d,u)))}}},i.Clipper.prototype.UpdateOutPtIdxs=function(n){var s=n.Pts;do s.Idx=n.Idx,s=s.Prev;while(s!==n.Pts)},i.Clipper.prototype.DoSimplePolygons=function(){for(var n=0;n<this.m_PolyOuts.length;){var s=this.m_PolyOuts[n++],a=s.Pts;if(!(a===null||s.IsOpen))do{for(var u=a.Next;u!==s.Pts;){if(i.IntPoint.op_Equality(a.Pt,u.Pt)&&u.Next!==a&&u.Prev!==a){var d=a.Prev,g=u.Prev;a.Prev=g,g.Next=a,u.Prev=d,d.Next=u,s.Pts=a;var y=this.CreateOutRec();y.Pts=u,this.UpdateOutPtIdxs(y),this.Poly2ContainsPoly1(y.Pts,s.Pts)?(y.IsHole=!s.IsHole,y.FirstLeft=s,this.m_UsingPolyTree&&this.FixupFirstLefts2(y,s)):this.Poly2ContainsPoly1(s.Pts,y.Pts)?(y.IsHole=s.IsHole,s.IsHole=!y.IsHole,y.FirstLeft=s.FirstLeft,s.FirstLeft=y,this.m_UsingPolyTree&&this.FixupFirstLefts2(s,y)):(y.IsHole=s.IsHole,y.FirstLeft=s.FirstLeft,this.m_UsingPolyTree&&this.FixupFirstLefts1(s,y)),u=a}u=u.Next}a=a.Next}while(a!==s.Pts)}},i.Clipper.Area=function(n){if(!Array.isArray(n))return 0;var s=n.length;if(s<3)return 0;for(var a=0,u=0,d=s-1;u<s;++u)a+=(n[d].X+n[u].X)*(n[d].Y-n[u].Y),d=u;return-a*.5},i.Clipper.prototype.Area=function(n){var s=n;if(n===null)return 0;var a=0;do a=a+(n.Prev.Pt.X+n.Pt.X)*(n.Prev.Pt.Y-n.Pt.Y),n=n.Next;while(n!==s);return a*.5},i.Clipper.prototype.Area$1=function(n){return this.Area(n.Pts)},i.Clipper.SimplifyPolygon=function(n,s){var a=new Array,u=new i.Clipper(0);return u.StrictlySimple=!0,u.AddPath(n,i.PolyType.ptSubject,!0),u.Execute(i.ClipType.ctUnion,a,s,s),a},i.Clipper.SimplifyPolygons=function(n,s){typeof s>"u"&&(s=i.PolyFillType.pftEvenOdd);var a=new Array,u=new i.Clipper(0);return u.StrictlySimple=!0,u.AddPaths(n,i.PolyType.ptSubject,!0),u.Execute(i.ClipType.ctUnion,a,s,s),a},i.Clipper.DistanceSqrd=function(n,s){var a=n.X-s.X,u=n.Y-s.Y;return a*a+u*u},i.Clipper.DistanceFromLineSqrd=function(n,s,a){var u=s.Y-a.Y,d=a.X-s.X,g=u*s.X+d*s.Y;return g=u*n.X+d*n.Y-g,g*g/(u*u+d*d)},i.Clipper.SlopesNearCollinear=function(n,s,a,u){return Math.abs(n.X-s.X)>Math.abs(n.Y-s.Y)?n.X>s.X==n.X<a.X?i.Clipper.DistanceFromLineSqrd(n,s,a)<u:s.X>n.X==s.X<a.X?i.Clipper.DistanceFromLineSqrd(s,n,a)<u:i.Clipper.DistanceFromLineSqrd(a,n,s)<u:n.Y>s.Y==n.Y<a.Y?i.Clipper.DistanceFromLineSqrd(n,s,a)<u:s.Y>n.Y==s.Y<a.Y?i.Clipper.DistanceFromLineSqrd(s,n,a)<u:i.Clipper.DistanceFromLineSqrd(a,n,s)<u},i.Clipper.PointsAreClose=function(n,s,a){var u=n.X-s.X,d=n.Y-s.Y;return u*u+d*d<=a},i.Clipper.ExcludeOp=function(n){var s=n.Prev;return s.Next=n.Next,n.Next.Prev=s,s.Idx=0,s},i.Clipper.CleanPolygon=function(n,s){typeof s>"u"&&(s=1.415);var a=n.length;if(a===0)return new Array;for(var u=new Array(a),d=0;d<a;++d)u[d]=new i.OutPt;for(var d=0;d<a;++d)u[d].Pt=n[d],u[d].Next=u[(d+1)%a],u[d].Next.Prev=u[d],u[d].Idx=0;for(var g=s*s,y=u[0];y.Idx===0&&y.Next!==y.Prev;)i.Clipper.PointsAreClose(y.Pt,y.Prev.Pt,g)?(y=i.Clipper.ExcludeOp(y),a--):i.Clipper.PointsAreClose(y.Prev.Pt,y.Next.Pt,g)?(i.Clipper.ExcludeOp(y.Next),y=i.Clipper.ExcludeOp(y),a-=2):i.Clipper.SlopesNearCollinear(y.Prev.Pt,y.Pt,y.Next.Pt,g)?(y=i.Clipper.ExcludeOp(y),a--):(y.Idx=1,y=y.Next);a<3&&(a=0);for(var M=new Array(a),d=0;d<a;++d)M[d]=new i.IntPoint1(y.Pt),y=y.Next;return u=null,M},i.Clipper.CleanPolygons=function(n,s){for(var a=new Array(n.length),u=0,d=n.length;u<d;u++)a[u]=i.Clipper.CleanPolygon(n[u],s);return a},i.Clipper.Minkowski=function(n,s,a,u){var d=u?1:0,g=n.length,y=s.length,M=new Array;if(a)for(var b=0;b<y;b++){for(var A=new Array(g),L=0,R=n.length,F=n[L];L<R;L++,F=n[L])A[L]=new i.IntPoint2(s[b].X+F.X,s[b].Y+F.Y);M.push(A)}else for(var b=0;b<y;b++){for(var A=new Array(g),L=0,R=n.length,F=n[L];L<R;L++,F=n[L])A[L]=new i.IntPoint2(s[b].X-F.X,s[b].Y-F.Y);M.push(A)}for(var G=new Array,b=0;b<y-1+d;b++)for(var L=0;L<g;L++){var J=new Array;J.push(M[b%y][L%g]),J.push(M[(b+1)%y][L%g]),J.push(M[(b+1)%y][(L+1)%g]),J.push(M[b%y][(L+1)%g]),i.Clipper.Orientation(J)||J.reverse(),G.push(J)}return G},i.Clipper.MinkowskiSum=function(n,s,a){if(s[0]instanceof Array){for(var d=s,y=new i.Paths,g=new i.Clipper,M=0;M<d.length;++M){var b=i.Clipper.Minkowski(n,d[M],!0,a);if(g.AddPaths(b,i.PolyType.ptSubject,!0),a){var u=i.Clipper.TranslatePath(d[M],n[0]);g.AddPath(u,i.PolyType.ptClip,!0)}}return g.Execute(i.ClipType.ctUnion,y,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),y}else{var u=s,d=i.Clipper.Minkowski(n,u,!0,a),g=new i.Clipper;return g.AddPaths(d,i.PolyType.ptSubject,!0),g.Execute(i.ClipType.ctUnion,d,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),d}},i.Clipper.TranslatePath=function(n,s){for(var a=new i.Path,u=0;u<n.length;u++)a.push(new i.IntPoint2(n[u].X+s.X,n[u].Y+s.Y));return a},i.Clipper.MinkowskiDiff=function(n,s){var a=i.Clipper.Minkowski(n,s,!1,!0),u=new i.Clipper;return u.AddPaths(a,i.PolyType.ptSubject,!0),u.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),a},i.Clipper.PolyTreeToPaths=function(n){var s=new Array;return i.Clipper.AddPolyNodeToPaths(n,i.Clipper.NodeType.ntAny,s),s},i.Clipper.AddPolyNodeToPaths=function(n,s,a){var u=!0;switch(s){case i.Clipper.NodeType.ntOpen:return;case i.Clipper.NodeType.ntClosed:u=!n.IsOpen;break;default:break}n.m_polygon.length>0&&u&&a.push(n.m_polygon);for(var d=0,g=n.Childs(),y=g.length,M=g[d];d<y;d++,M=g[d])i.Clipper.AddPolyNodeToPaths(M,s,a)},i.Clipper.OpenPathsFromPolyTree=function(n){for(var s=new i.Paths,a=0,u=n.ChildCount();a<u;a++)n.Childs()[a].IsOpen&&s.push(n.Childs()[a].m_polygon);return s},i.Clipper.ClosedPathsFromPolyTree=function(n){var s=new i.Paths;return i.Clipper.AddPolyNodeToPaths(n,i.Clipper.NodeType.ntClosed,s),s},Os(i.Clipper,i.ClipperBase),i.Clipper.NodeType={ntAny:0,ntOpen:1,ntClosed:2},i.ClipperOffset=function(n,s){typeof n>"u"&&(n=2),typeof s>"u"&&(s=i.ClipperOffset.def_arc_tolerance),this.m_destPolys=new i.Paths,this.m_srcPoly=new i.Path,this.m_destPoly=new i.Path,this.m_normals=new Array,this.m_delta=0,this.m_sinA=0,this.m_sin=0,this.m_cos=0,this.m_miterLim=0,this.m_StepsPerRad=0,this.m_lowest=new i.IntPoint0,this.m_polyNodes=new i.PolyNode,this.MiterLimit=n,this.ArcTolerance=s,this.m_lowest.X=-1},i.ClipperOffset.two_pi=6.28318530717959,i.ClipperOffset.def_arc_tolerance=.25,i.ClipperOffset.prototype.Clear=function(){i.Clear(this.m_polyNodes.Childs()),this.m_lowest.X=-1},i.ClipperOffset.Round=i.Clipper.Round,i.ClipperOffset.prototype.AddPath=function(n,s,a){var u=n.length-1;if(!(u<0)){var d=new i.PolyNode;if(d.m_jointype=s,d.m_endtype=a,a===i.EndType.etClosedLine||a===i.EndType.etClosedPolygon)for(;u>0&&i.IntPoint.op_Equality(n[0],n[u]);)u--;d.m_polygon.push(n[0]);for(var g=0,y=0,M=1;M<=u;M++)i.IntPoint.op_Inequality(d.m_polygon[g],n[M])&&(g++,d.m_polygon.push(n[M]),(n[M].Y>d.m_polygon[y].Y||n[M].Y===d.m_polygon[y].Y&&n[M].X<d.m_polygon[y].X)&&(y=g));if(!(a===i.EndType.etClosedPolygon&&g<2)&&(this.m_polyNodes.AddChild(d),a===i.EndType.etClosedPolygon))if(this.m_lowest.X<0)this.m_lowest=new i.IntPoint2(this.m_polyNodes.ChildCount()-1,y);else{var b=this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon[this.m_lowest.Y];(d.m_polygon[y].Y>b.Y||d.m_polygon[y].Y===b.Y&&d.m_polygon[y].X<b.X)&&(this.m_lowest=new i.IntPoint2(this.m_polyNodes.ChildCount()-1,y))}}},i.ClipperOffset.prototype.AddPaths=function(n,s,a){for(var u=0,d=n.length;u<d;u++)this.AddPath(n[u],s,a)},i.ClipperOffset.prototype.FixOrientations=function(){if(this.m_lowest.X>=0&&!i.Clipper.Orientation(this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon))for(var n=0;n<this.m_polyNodes.ChildCount();n++){var s=this.m_polyNodes.Childs()[n];(s.m_endtype===i.EndType.etClosedPolygon||s.m_endtype===i.EndType.etClosedLine&&i.Clipper.Orientation(s.m_polygon))&&s.m_polygon.reverse()}else for(var n=0;n<this.m_polyNodes.ChildCount();n++){var s=this.m_polyNodes.Childs()[n];s.m_endtype===i.EndType.etClosedLine&&!i.Clipper.Orientation(s.m_polygon)&&s.m_polygon.reverse()}},i.ClipperOffset.GetUnitNormal=function(n,s){var a=s.X-n.X,u=s.Y-n.Y;if(a===0&&u===0)return new i.DoublePoint2(0,0);var d=1/Math.sqrt(a*a+u*u);return a*=d,u*=d,new i.DoublePoint2(u,-a)},i.ClipperOffset.prototype.DoOffset=function(n){if(this.m_destPolys=new Array,this.m_delta=n,i.ClipperBase.near_zero(n)){for(var s=0;s<this.m_polyNodes.ChildCount();s++){var a=this.m_polyNodes.Childs()[s];a.m_endtype===i.EndType.etClosedPolygon&&this.m_destPolys.push(a.m_polygon)}return}this.MiterLimit>2?this.m_miterLim=2/(this.MiterLimit*this.MiterLimit):this.m_miterLim=.5;var u;this.ArcTolerance<=0?u=i.ClipperOffset.def_arc_tolerance:this.ArcTolerance>Math.abs(n)*i.ClipperOffset.def_arc_tolerance?u=Math.abs(n)*i.ClipperOffset.def_arc_tolerance:u=this.ArcTolerance;var d=3.14159265358979/Math.acos(1-u/Math.abs(n));this.m_sin=Math.sin(i.ClipperOffset.two_pi/d),this.m_cos=Math.cos(i.ClipperOffset.two_pi/d),this.m_StepsPerRad=d/i.ClipperOffset.two_pi,n<0&&(this.m_sin=-this.m_sin);for(var s=0;s<this.m_polyNodes.ChildCount();s++){var a=this.m_polyNodes.Childs()[s];this.m_srcPoly=a.m_polygon;var g=this.m_srcPoly.length;if(!(g===0||n<=0&&(g<3||a.m_endtype!==i.EndType.etClosedPolygon))){if(this.m_destPoly=new Array,g===1){if(a.m_jointype===i.JoinType.jtRound)for(var y=1,M=0,b=1;b<=d;b++){this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+y*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+M*n)));var A=y;y=y*this.m_cos-this.m_sin*M,M=A*this.m_sin+M*this.m_cos}else for(var y=-1,M=-1,b=0;b<4;++b)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+y*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+M*n))),y<0?y=1:M<0?M=1:y=-1;this.m_destPolys.push(this.m_destPoly);continue}this.m_normals.length=0;for(var b=0;b<g-1;b++)this.m_normals.push(i.ClipperOffset.GetUnitNormal(this.m_srcPoly[b],this.m_srcPoly[b+1]));if(a.m_endtype===i.EndType.etClosedLine||a.m_endtype===i.EndType.etClosedPolygon?this.m_normals.push(i.ClipperOffset.GetUnitNormal(this.m_srcPoly[g-1],this.m_srcPoly[0])):this.m_normals.push(new i.DoublePoint1(this.m_normals[g-2])),a.m_endtype===i.EndType.etClosedPolygon){for(var L=g-1,b=0;b<g;b++)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly)}else if(a.m_endtype===i.EndType.etClosedLine){for(var L=g-1,b=0;b<g;b++)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly),this.m_destPoly=new Array;for(var R=this.m_normals[g-1],b=g-1;b>0;b--)this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b-1].X,-this.m_normals[b-1].Y);this.m_normals[0]=new i.DoublePoint2(-R.X,-R.Y),L=0;for(var b=g-1;b>=0;b--)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly)}else{for(var L=0,b=1;b<g-1;++b)L=this.OffsetPoint(b,L,a.m_jointype);var F;if(a.m_endtype===i.EndType.etOpenButt){var b=g-1;F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[b].X+this.m_normals[b].X*n),i.ClipperOffset.Round(this.m_srcPoly[b].Y+this.m_normals[b].Y*n)),this.m_destPoly.push(F),F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[b].X-this.m_normals[b].X*n),i.ClipperOffset.Round(this.m_srcPoly[b].Y-this.m_normals[b].Y*n)),this.m_destPoly.push(F)}else{var b=g-1;L=g-2,this.m_sinA=0,this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b].X,-this.m_normals[b].Y),a.m_endtype===i.EndType.etOpenSquare?this.DoSquare(b,L):this.DoRound(b,L)}for(var b=g-1;b>0;b--)this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b-1].X,-this.m_normals[b-1].Y);this.m_normals[0]=new i.DoublePoint2(-this.m_normals[1].X,-this.m_normals[1].Y),L=g-1;for(var b=L-1;b>0;--b)L=this.OffsetPoint(b,L,a.m_jointype);a.m_endtype===i.EndType.etOpenButt?(F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X-this.m_normals[0].X*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y-this.m_normals[0].Y*n)),this.m_destPoly.push(F),F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+this.m_normals[0].X*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+this.m_normals[0].Y*n)),this.m_destPoly.push(F)):(L=1,this.m_sinA=0,a.m_endtype===i.EndType.etOpenSquare?this.DoSquare(0,1):this.DoRound(0,1)),this.m_destPolys.push(this.m_destPoly)}}}},i.ClipperOffset.prototype.Execute=function(){var n=arguments,s=n[0]instanceof i.PolyTree;if(s){var a=n[0],u=n[1];a.Clear(),this.FixOrientations(),this.DoOffset(u);var d=new i.Clipper(0);if(d.AddPaths(this.m_destPolys,i.PolyType.ptSubject,!0),u>0)d.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftPositive,i.PolyFillType.pftPositive);else{var g=i.Clipper.GetBounds(this.m_destPolys),y=new i.Path;if(y.push(new i.IntPoint2(g.left-10,g.bottom+10)),y.push(new i.IntPoint2(g.right+10,g.bottom+10)),y.push(new i.IntPoint2(g.right+10,g.top-10)),y.push(new i.IntPoint2(g.left-10,g.top-10)),d.AddPath(y,i.PolyType.ptSubject,!0),d.ReverseSolution=!0,d.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNegative,i.PolyFillType.pftNegative),a.ChildCount()===1&&a.Childs()[0].ChildCount()>0){var M=a.Childs()[0];a.Childs()[0]=M.Childs()[0],a.Childs()[0].m_Parent=a;for(var b=1;b<M.ChildCount();b++)a.AddChild(M.Childs()[b])}else a.Clear()}}else{var a=n[0],u=n[1];i.Clear(a),this.FixOrientations(),this.DoOffset(u);var d=new i.Clipper(0);if(d.AddPaths(this.m_destPolys,i.PolyType.ptSubject,!0),u>0)d.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftPositive,i.PolyFillType.pftPositive);else{var g=i.Clipper.GetBounds(this.m_destPolys),y=new i.Path;y.push(new i.IntPoint2(g.left-10,g.bottom+10)),y.push(new i.IntPoint2(g.right+10,g.bottom+10)),y.push(new i.IntPoint2(g.right+10,g.top-10)),y.push(new i.IntPoint2(g.left-10,g.top-10)),d.AddPath(y,i.PolyType.ptSubject,!0),d.ReverseSolution=!0,d.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNegative,i.PolyFillType.pftNegative),a.length>0&&a.splice(0,1)}}},i.ClipperOffset.prototype.OffsetPoint=function(n,s,a){if(this.m_sinA=this.m_normals[s].X*this.m_normals[n].Y-this.m_normals[n].X*this.m_normals[s].Y,Math.abs(this.m_sinA*this.m_delta)<1){var u=this.m_normals[s].X*this.m_normals[n].X+this.m_normals[n].Y*this.m_normals[s].Y;if(u>0)return this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[s].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[s].Y*this.m_delta))),s}else this.m_sinA>1?this.m_sinA=1:this.m_sinA<-1&&(this.m_sinA=-1);if(this.m_sinA*this.m_delta<0)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[s].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[s].Y*this.m_delta))),this.m_destPoly.push(new i.IntPoint1(this.m_srcPoly[n])),this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[n].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[n].Y*this.m_delta)));else switch(a){case i.JoinType.jtMiter:{var d=1+(this.m_normals[n].X*this.m_normals[s].X+this.m_normals[n].Y*this.m_normals[s].Y);d>=this.m_miterLim?this.DoMiter(n,s,d):this.DoSquare(n,s);break}case i.JoinType.jtSquare:this.DoSquare(n,s);break;case i.JoinType.jtRound:this.DoRound(n,s);break}return s=n,s},i.ClipperOffset.prototype.DoSquare=function(n,s){var a=Math.tan(Math.atan2(this.m_sinA,this.m_normals[s].X*this.m_normals[n].X+this.m_normals[s].Y*this.m_normals[n].Y)/4);this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_delta*(this.m_normals[s].X-this.m_normals[s].Y*a)),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_delta*(this.m_normals[s].Y+this.m_normals[s].X*a)))),this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_delta*(this.m_normals[n].X+this.m_normals[n].Y*a)),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_delta*(this.m_normals[n].Y-this.m_normals[n].X*a))))},i.ClipperOffset.prototype.DoMiter=function(n,s,a){var u=this.m_delta/a;this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+(this.m_normals[s].X+this.m_normals[n].X)*u),i.ClipperOffset.Round(this.m_srcPoly[n].Y+(this.m_normals[s].Y+this.m_normals[n].Y)*u)))},i.ClipperOffset.prototype.DoRound=function(n,s){for(var a=Math.atan2(this.m_sinA,this.m_normals[s].X*this.m_normals[n].X+this.m_normals[s].Y*this.m_normals[n].Y),u=Math.max(i.Cast_Int32(i.ClipperOffset.Round(this.m_StepsPerRad*Math.abs(a))),1),d=this.m_normals[s].X,g=this.m_normals[s].Y,y,M=0;M<u;++M)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+d*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+g*this.m_delta))),y=d,d=d*this.m_cos-this.m_sin*g,g=y*this.m_sin+g*this.m_cos;this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[n].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[n].Y*this.m_delta)))},i.Error=function(n){try{throw new Error(n)}catch(s){alert(s.message)}},i.JS={},i.JS.AreaOfPolygon=function(n,s){return s||(s=1),i.Clipper.Area(n)/(s*s)},i.JS.AreaOfPolygons=function(n,s){s||(s=1);for(var a=0,u=0;u<n.length;u++)a+=i.Clipper.Area(n[u]);return a/(s*s)},i.JS.BoundsOfPath=function(n,s){return i.JS.BoundsOfPaths([n],s)},i.JS.BoundsOfPaths=function(n,s){s||(s=1);var a=i.Clipper.GetBounds(n);return a.left/=s,a.bottom/=s,a.right/=s,a.top/=s,a},i.JS.Clean=function(u,s){if(!(u instanceof Array))return[];var a=u[0]instanceof Array,u=i.JS.Clone(u);if(typeof s!="number"||s===null)return i.Error("Delta is not a number in Clean()."),u;if(u.length===0||u.length===1&&u[0].length===0||s<0)return u;a||(u=[u]);for(var d=u.length,g,y,M,b,A,L,R,F=[],G=0;G<d;G++)if(y=u[G],g=y.length,g!==0){if(g<3){M=y,F.push(M);continue}for(M=y,b=s*s,A=y[0],L=1,R=1;R<g;R++)(y[R].X-A.X)*(y[R].X-A.X)+(y[R].Y-A.Y)*(y[R].Y-A.Y)<=b||(M[L]=y[R],A=y[R],L++);A=y[L-1],(y[0].X-A.X)*(y[0].X-A.X)+(y[0].Y-A.Y)*(y[0].Y-A.Y)<=b&&L--,L<g&&M.splice(L,g-L),M.length&&F.push(M)}return!a&&F.length?F=F[0]:!a&&F.length===0?F=[]:a&&F.length===0&&(F=[[]]),F},i.JS.Clone=function(n){if(!(n instanceof Array))return[];if(n.length===0)return[];if(n.length===1&&n[0].length===0)return[[]];var s=n[0]instanceof Array;s||(n=[n]);var a=n.length,u,d,g,y,M=new Array(a);for(d=0;d<a;d++){for(u=n[d].length,y=new Array(u),g=0;g<u;g++)y[g]={X:n[d][g].X,Y:n[d][g].Y};M[d]=y}return s||(M=M[0]),M},i.JS.Lighten=function(n,s){if(!(n instanceof Array))return[];if(typeof s!="number"||s===null)return i.Error("Tolerance is not a number in Lighten()."),i.JS.Clone(n);if(n.length===0||n.length===1&&n[0].length===0||s<0)return i.JS.Clone(n);var a=n[0]instanceof Array;a||(n=[n]);var u,d,g,y,M,b,A,L,R,F,G,J,K,nt,bt,Gt,Oe,nc=n.length,ic=s*s,Fe=[];for(u=0;u<nc;u++)if(g=n[u],b=g.length,b!==0){for(y=0;y<1e6;y++){for(M=[],b=g.length,g[b-1].X!==g[0].X||g[b-1].Y!==g[0].Y?(J=1,g.push({X:g[0].X,Y:g[0].Y}),b=g.length):J=0,G=[],d=0;d<b-2;d++)A=g[d],R=g[d+1],L=g[d+2],Gt=A.X,Oe=A.Y,K=L.X-Gt,nt=L.Y-Oe,(K!==0||nt!==0)&&(bt=((R.X-Gt)*K+(R.Y-Oe)*nt)/(K*K+nt*nt),bt>1?(Gt=L.X,Oe=L.Y):bt>0&&(Gt+=K*bt,Oe+=nt*bt)),K=R.X-Gt,nt=R.Y-Oe,F=K*K+nt*nt,F<=ic&&(G[d+1]=1,d++);for(M.push({X:g[0].X,Y:g[0].Y}),d=1;d<b-1;d++)G[d]||M.push({X:g[d].X,Y:g[d].Y});if(M.push({X:g[b-1].X,Y:g[b-1].Y}),J&&g.pop(),G.length)g=M;else break}b=M.length,M[b-1].X===M[0].X&&M[b-1].Y===M[0].Y&&M.pop(),M.length>2&&Fe.push(M)}return a||(Fe=Fe[0]),typeof Fe>"u"&&(Fe=[]),Fe},i.JS.PerimeterOfPath=function(n,s,a){if(typeof n>"u")return 0;var u=Math.sqrt,d=0,g,y,M=0,b=0,A=0,L=0,R=n.length;if(R<2)return 0;for(s&&(n[R]=n[0],R++);--R;)g=n[R],M=g.X,b=g.Y,y=n[R-1],A=y.X,L=y.Y,d+=u((M-A)*(M-A)+(b-L)*(b-L));return s&&n.pop(),d/a},i.JS.PerimeterOfPaths=function(n,s,a){a||(a=1);for(var u=0,d=0;d<n.length;d++)u+=i.JS.PerimeterOfPath(n[d],s,a);return u},i.JS.ScaleDownPath=function(n,s){var a,u;for(s||(s=1),a=n.length;a--;)u=n[a],u.X=u.X/s,u.Y=u.Y/s},i.JS.ScaleDownPaths=function(n,s){var a,u,d;for(s||(s=1),a=n.length;a--;)for(u=n[a].length;u--;)d=n[a][u],d.X=d.X/s,d.Y=d.Y/s},i.JS.ScaleUpPath=function(n,s){var a,u,d=Math.round;for(s||(s=1),a=n.length;a--;)u=n[a],u.X=d(u.X*s),u.Y=d(u.Y*s)},i.JS.ScaleUpPaths=function(n,s){var a,u,d,g=Math.round;for(s||(s=1),a=n.length;a--;)for(u=n[a].length;u--;)d=n[a][u],d.X=g(d.X*s),d.Y=g(d.Y*s)},i.ExPolygons=function(){return[]},i.ExPolygon=function(){this.outer=null,this.holes=null},i.JS.AddOuterPolyNodeToExPolygons=function(n,s){var a=new i.ExPolygon;a.outer=n.Contour();var u=n.Childs(),d=u.length;a.holes=new Array(d);var g,y,M,b,A,L;for(M=0;M<d;M++)for(g=u[M],a.holes[M]=g.Contour(),b=0,A=g.Childs(),L=A.length;b<L;b++)y=A[b],i.JS.AddOuterPolyNodeToExPolygons(y,s);s.push(a)},i.JS.ExPolygonsToPaths=function(n){var s,a,u,d,g=new i.Paths;for(s=0,u=n.length;s<u;s++)for(g.push(n[s].outer),a=0,d=n[s].holes.length;a<d;a++)g.push(n[s].holes[a]);return g},i.JS.PolyTreeToExPolygons=function(n){var s=new i.ExPolygons,a,u,d,g;for(u=0,d=n.Childs(),g=d.length;u<g;u++)a=d[u],i.JS.AddOuterPolyNodeToExPolygons(a,s);return s}})()});var pe=st(Ie=>{var ps,yd=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];Ie.getSymbolSize=function(t){if(!t)throw new Error('"version" cannot be null or undefined');if(t<1||t>40)throw new Error('"version" should be in range from 1 to 40');return t*4+17};Ie.getSymbolTotalCodewords=function(t){return yd[t]};Ie.getBCHDigit=function(i){let t=0;for(;i!==0;)t++,i>>>=1;return t};Ie.setToSJISFunction=function(t){if(typeof t!="function")throw new Error('"toSJISFunc" is not a valid function.');ps=t};Ie.isKanjiModeEnabled=function(){return typeof ps<"u"};Ie.toSJIS=function(t){return ps(t)}});var Zi=st(Ot=>{Ot.L={bit:1};Ot.M={bit:0};Ot.Q={bit:3};Ot.H={bit:2};function vd(i){if(typeof i!="string")throw new Error("Param is not a string");switch(i.toLowerCase()){case"l":case"low":return Ot.L;case"m":case"medium":return Ot.M;case"q":case"quartile":return Ot.Q;case"h":case"high":return Ot.H;default:throw new Error("Unknown EC Level: "+i)}}Ot.isValid=function(t){return t&&typeof t.bit<"u"&&t.bit>=0&&t.bit<4};Ot.from=function(t,e){if(Ot.isValid(t))return t;try{return vd(t)}catch{return e}}});var qo=st((Tv,Yo)=>{function Wo(){this.buffer=[],this.length=0}Wo.prototype={get:function(i){let t=Math.floor(i/8);return(this.buffer[t]>>>7-i%8&1)===1},put:function(i,t){for(let e=0;e<t;e++)this.putBit((i>>>t-e-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(i){let t=Math.floor(this.length/8);this.buffer.length<=t&&this.buffer.push(0),i&&(this.buffer[t]|=128>>>this.length%8),this.length++}};Yo.exports=Wo});var Jo=st((wv,Zo)=>{function Bn(i){if(!i||i<1)throw new Error("BitMatrix size must be defined and greater than 0");this.size=i,this.data=new Uint8Array(i*i),this.reservedBit=new Uint8Array(i*i)}Bn.prototype.set=function(i,t,e,r){let o=i*this.size+t;this.data[o]=e,r&&(this.reservedBit[o]=!0)};Bn.prototype.get=function(i,t){return this.data[i*this.size+t]};Bn.prototype.xor=function(i,t,e){this.data[i*this.size+t]^=e};Bn.prototype.isReserved=function(i,t){return this.reservedBit[i*this.size+t]};Zo.exports=Bn});var Ko=st(Ji=>{var Sd=pe().getSymbolSize;Ji.getRowColCoords=function(t){if(t===1)return[];let e=Math.floor(t/7)+2,r=Sd(t),o=r===145?26:Math.ceil((r-13)/(2*e-2))*2,l=[r-7];for(let c=1;c<e-1;c++)l[c]=l[c-1]-o;return l.push(6),l.reverse()};Ji.getPositions=function(t){let e=[],r=Ji.getRowColCoords(t),o=r.length;for(let l=0;l<o;l++)for(let c=0;c<o;c++)l===0&&c===0||l===0&&c===o-1||l===o-1&&c===0||e.push([r[l],r[c]]);return e}});var Qo=st(jo=>{var Md=pe().getSymbolSize,$o=7;jo.getPositions=function(t){let e=Md(t);return[[0,0],[e-$o,0],[0,e-$o]]}});var ta=st(it=>{it.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};var Re={N1:3,N2:3,N3:40,N4:10};it.isValid=function(t){return t!=null&&t!==""&&!isNaN(t)&&t>=0&&t<=7};it.from=function(t){return it.isValid(t)?parseInt(t,10):void 0};it.getPenaltyN1=function(t){let e=t.size,r=0,o=0,l=0,c=null,f=null;for(let h=0;h<e;h++){o=l=0,c=f=null;for(let p=0;p<e;p++){let m=t.get(h,p);m===c?o++:(o>=5&&(r+=Re.N1+(o-5)),c=m,o=1),m=t.get(p,h),m===f?l++:(l>=5&&(r+=Re.N1+(l-5)),f=m,l=1)}o>=5&&(r+=Re.N1+(o-5)),l>=5&&(r+=Re.N1+(l-5))}return r};it.getPenaltyN2=function(t){let e=t.size,r=0;for(let o=0;o<e-1;o++)for(let l=0;l<e-1;l++){let c=t.get(o,l)+t.get(o,l+1)+t.get(o+1,l)+t.get(o+1,l+1);(c===4||c===0)&&r++}return r*Re.N2};it.getPenaltyN3=function(t){let e=t.size,r=0,o=0,l=0;for(let c=0;c<e;c++){o=l=0;for(let f=0;f<e;f++)o=o<<1&2047|t.get(c,f),f>=10&&(o===1488||o===93)&&r++,l=l<<1&2047|t.get(f,c),f>=10&&(l===1488||l===93)&&r++}return r*Re.N3};it.getPenaltyN4=function(t){let e=0,r=t.data.length;for(let l=0;l<r;l++)e+=t.data[l];return Math.abs(Math.ceil(e*100/r/5)-10)*Re.N4};function bd(i,t,e){switch(i){case it.Patterns.PATTERN000:return(t+e)%2===0;case it.Patterns.PATTERN001:return t%2===0;case it.Patterns.PATTERN010:return e%3===0;case it.Patterns.PATTERN011:return(t+e)%3===0;case it.Patterns.PATTERN100:return(Math.floor(t/2)+Math.floor(e/3))%2===0;case it.Patterns.PATTERN101:return t*e%2+t*e%3===0;case it.Patterns.PATTERN110:return(t*e%2+t*e%3)%2===0;case it.Patterns.PATTERN111:return(t*e%3+(t+e)%2)%2===0;default:throw new Error("bad maskPattern:"+i)}}it.applyMask=function(t,e){let r=e.size;for(let o=0;o<r;o++)for(let l=0;l<r;l++)e.isReserved(l,o)||e.xor(l,o,bd(t,l,o))};it.getBestMask=function(t,e){let r=Object.keys(it.Patterns).length,o=0,l=1/0;for(let c=0;c<r;c++){e(c),it.applyMask(c,t);let f=it.getPenaltyN1(t)+it.getPenaltyN2(t)+it.getPenaltyN3(t)+it.getPenaltyN4(t);it.applyMask(c,t),f<l&&(l=f,o=c)}return o}});var gs=st(ms=>{var me=Zi(),Ki=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],$i=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];ms.getBlocksCount=function(t,e){switch(e){case me.L:return Ki[(t-1)*4+0];case me.M:return Ki[(t-1)*4+1];case me.Q:return Ki[(t-1)*4+2];case me.H:return Ki[(t-1)*4+3];default:return}};ms.getTotalCodewordsCount=function(t,e){switch(e){case me.L:return $i[(t-1)*4+0];case me.M:return $i[(t-1)*4+1];case me.Q:return $i[(t-1)*4+2];case me.H:return $i[(t-1)*4+3];default:return}}});var ea=st(Qi=>{var Un=new Uint8Array(512),ji=new Uint8Array(256);(function(){let t=1;for(let e=0;e<255;e++)Un[e]=t,ji[t]=e,t<<=1,t&256&&(t^=285);for(let e=255;e<512;e++)Un[e]=Un[e-255]})();Qi.log=function(t){if(t<1)throw new Error("log("+t+")");return ji[t]};Qi.exp=function(t){return Un[t]};Qi.mul=function(t,e){return t===0||e===0?0:Un[ji[t]+ji[e]]}});var na=st(zn=>{var xs=ea();zn.mul=function(t,e){let r=new Uint8Array(t.length+e.length-1);for(let o=0;o<t.length;o++)for(let l=0;l<e.length;l++)r[o+l]^=xs.mul(t[o],e[l]);return r};zn.mod=function(t,e){let r=new Uint8Array(t);for(;r.length-e.length>=0;){let o=r[0];for(let c=0;c<e.length;c++)r[c]^=xs.mul(e[c],o);let l=0;for(;l<r.length&&r[l]===0;)l++;r=r.slice(l)}return r};zn.generateECPolynomial=function(t){let e=new Uint8Array([1]);for(let r=0;r<t;r++)e=zn.mul(e,new Uint8Array([1,xs.exp(r)]));return e}});var sa=st((Nv,ra)=>{var ia=na();function _s(i){this.genPoly=void 0,this.degree=i,this.degree&&this.initialize(this.degree)}_s.prototype.initialize=function(t){this.degree=t,this.genPoly=ia.generateECPolynomial(this.degree)};_s.prototype.encode=function(t){if(!this.genPoly)throw new Error("Encoder not initialized");let e=new Uint8Array(t.length+this.degree);e.set(t);let r=ia.mod(e,this.genPoly),o=this.degree-r.length;if(o>0){let l=new Uint8Array(this.degree);return l.set(r,o),l}return r};ra.exports=_s});var ys=st(oa=>{oa.isValid=function(t){return!isNaN(t)&&t>=1&&t<=40}});var vs=st(ee=>{var aa="[0-9]+",Ed="[A-Z $%*+\\-./:]+",kn="(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";kn=kn.replace(/u/g,"\\u");var Td="(?:(?![A-Z0-9 $%*+\\-./:]|"+kn+`)(?:.|[\r
]))+`;ee.KANJI=new RegExp(kn,"g");ee.BYTE_KANJI=new RegExp("[^A-Z0-9 $%*+\\-./:]+","g");ee.BYTE=new RegExp(Td,"g");ee.NUMERIC=new RegExp(aa,"g");ee.ALPHANUMERIC=new RegExp(Ed,"g");var wd=new RegExp("^"+kn+"$"),Ad=new RegExp("^"+aa+"$"),Cd=new RegExp("^[A-Z0-9 $%*+\\-./:]+$");ee.testKanji=function(t){return wd.test(t)};ee.testNumeric=function(t){return Ad.test(t)};ee.testAlphanumeric=function(t){return Cd.test(t)}});var ge=st(dt=>{var Pd=ys(),Ss=vs();dt.NUMERIC={id:"Numeric",bit:1,ccBits:[10,12,14]};dt.ALPHANUMERIC={id:"Alphanumeric",bit:2,ccBits:[9,11,13]};dt.BYTE={id:"Byte",bit:4,ccBits:[8,16,16]};dt.KANJI={id:"Kanji",bit:8,ccBits:[8,10,12]};dt.MIXED={bit:-1};dt.getCharCountIndicator=function(t,e){if(!t.ccBits)throw new Error("Invalid mode: "+t);if(!Pd.isValid(e))throw new Error("Invalid version: "+e);return e>=1&&e<10?t.ccBits[0]:e<27?t.ccBits[1]:t.ccBits[2]};dt.getBestModeForData=function(t){return Ss.testNumeric(t)?dt.NUMERIC:Ss.testAlphanumeric(t)?dt.ALPHANUMERIC:Ss.testKanji(t)?dt.KANJI:dt.BYTE};dt.toString=function(t){if(t&&t.id)return t.id;throw new Error("Invalid mode")};dt.isValid=function(t){return t&&t.bit&&t.ccBits};function Id(i){if(typeof i!="string")throw new Error("Param is not a string");switch(i.toLowerCase()){case"numeric":return dt.NUMERIC;case"alphanumeric":return dt.ALPHANUMERIC;case"kanji":return dt.KANJI;case"byte":return dt.BYTE;default:throw new Error("Unknown mode: "+i)}}dt.from=function(t,e){if(dt.isValid(t))return t;try{return Id(t)}catch{return e}}});var fa=st(Le=>{var tr=pe(),Rd=gs(),la=Zi(),xe=ge(),Ms=ys(),ua=7973,ca=tr.getBCHDigit(ua);function Ld(i,t,e){for(let r=1;r<=40;r++)if(t<=Le.getCapacity(r,e,i))return r}function ha(i,t){return xe.getCharCountIndicator(i,t)+4}function Nd(i,t){let e=0;return i.forEach(function(r){let o=ha(r.mode,t);e+=o+r.getBitsLength()}),e}function Dd(i,t){for(let e=1;e<=40;e++)if(Nd(i,e)<=Le.getCapacity(e,t,xe.MIXED))return e}Le.from=function(t,e){return Ms.isValid(t)?parseInt(t,10):e};Le.getCapacity=function(t,e,r){if(!Ms.isValid(t))throw new Error("Invalid QR Code version");typeof r>"u"&&(r=xe.BYTE);let o=tr.getSymbolTotalCodewords(t),l=Rd.getTotalCodewordsCount(t,e),c=(o-l)*8;if(r===xe.MIXED)return c;let f=c-ha(r,t);switch(r){case xe.NUMERIC:return Math.floor(f/10*3);case xe.ALPHANUMERIC:return Math.floor(f/11*2);case xe.KANJI:return Math.floor(f/13);case xe.BYTE:default:return Math.floor(f/8)}};Le.getBestVersionForData=function(t,e){let r,o=la.from(e,la.M);if(Array.isArray(t)){if(t.length>1)return Dd(t,o);if(t.length===0)return 1;r=t[0]}else r=t;return Ld(r.mode,r.getLength(),o)};Le.getEncodedBits=function(t){if(!Ms.isValid(t)||t<7)throw new Error("Invalid QR Code version");let e=t<<12;for(;tr.getBCHDigit(e)-ca>=0;)e^=ua<<tr.getBCHDigit(e)-ca;return t<<12|e}});var ga=st(ma=>{var bs=pe(),pa=1335,Od=21522,da=bs.getBCHDigit(pa);ma.getEncodedBits=function(t,e){let r=t.bit<<3|e,o=r<<10;for(;bs.getBCHDigit(o)-da>=0;)o^=pa<<bs.getBCHDigit(o)-da;return(r<<10|o)^Od}});var _a=st((zv,xa)=>{var Fd=ge();function an(i){this.mode=Fd.NUMERIC,this.data=i.toString()}an.getBitsLength=function(t){return 10*Math.floor(t/3)+(t%3?t%3*3+1:0)};an.prototype.getLength=function(){return this.data.length};an.prototype.getBitsLength=function(){return an.getBitsLength(this.data.length)};an.prototype.write=function(t){let e,r,o;for(e=0;e+3<=this.data.length;e+=3)r=this.data.substr(e,3),o=parseInt(r,10),t.put(o,10);let l=this.data.length-e;l>0&&(r=this.data.substr(e),o=parseInt(r,10),t.put(o,l*3+1))};xa.exports=an});var va=st((kv,ya)=>{var Bd=ge(),Es=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];function ln(i){this.mode=Bd.ALPHANUMERIC,this.data=i}ln.getBitsLength=function(t){return 11*Math.floor(t/2)+6*(t%2)};ln.prototype.getLength=function(){return this.data.length};ln.prototype.getBitsLength=function(){return ln.getBitsLength(this.data.length)};ln.prototype.write=function(t){let e;for(e=0;e+2<=this.data.length;e+=2){let r=Es.indexOf(this.data[e])*45;r+=Es.indexOf(this.data[e+1]),t.put(r,11)}this.data.length%2&&t.put(Es.indexOf(this.data[e]),6)};ya.exports=ln});var Ma=st((Vv,Sa)=>{var Ud=ge();function cn(i){this.mode=Ud.BYTE,typeof i=="string"?this.data=new TextEncoder().encode(i):this.data=new Uint8Array(i)}cn.getBitsLength=function(t){return t*8};cn.prototype.getLength=function(){return this.data.length};cn.prototype.getBitsLength=function(){return cn.getBitsLength(this.data.length)};cn.prototype.write=function(i){for(let t=0,e=this.data.length;t<e;t++)i.put(this.data[t],8)};Sa.exports=cn});var Ea=st((Hv,ba)=>{var zd=ge(),kd=pe();function un(i){this.mode=zd.KANJI,this.data=i}un.getBitsLength=function(t){return t*13};un.prototype.getLength=function(){return this.data.length};un.prototype.getBitsLength=function(){return un.getBitsLength(this.data.length)};un.prototype.write=function(i){let t;for(t=0;t<this.data.length;t++){let e=kd.toSJIS(this.data[t]);if(e>=33088&&e<=40956)e-=33088;else if(e>=57408&&e<=60351)e-=49472;else throw new Error("Invalid SJIS character: "+this.data[t]+`
Make sure your charset is UTF-8`);e=(e>>>8&255)*192+(e&255),i.put(e,13)}};ba.exports=un});var Ta=st((Gv,Ts)=>{"use strict";var Vn={single_source_shortest_paths:function(i,t,e){var r={},o={};o[t]=0;var l=Vn.PriorityQueue.make();l.push(t,0);for(var c,f,h,p,m,x,_,v,S;!l.empty();){c=l.pop(),f=c.value,p=c.cost,m=i[f]||{};for(h in m)m.hasOwnProperty(h)&&(x=m[h],_=p+x,v=o[h],S=typeof o[h]>"u",(S||v>_)&&(o[h]=_,l.push(h,_),r[h]=f))}if(typeof e<"u"&&typeof o[e]>"u"){var E=["Could not find a path from ",t," to ",e,"."].join("");throw new Error(E)}return r},extract_shortest_path_from_predecessor_list:function(i,t){for(var e=[],r=t,o;r;)e.push(r),o=i[r],r=i[r];return e.reverse(),e},find_path:function(i,t,e){var r=Vn.single_source_shortest_paths(i,t,e);return Vn.extract_shortest_path_from_predecessor_list(r,e)},PriorityQueue:{make:function(i){var t=Vn.PriorityQueue,e={},r;i=i||{};for(r in t)t.hasOwnProperty(r)&&(e[r]=t[r]);return e.queue=[],e.sorter=i.sorter||t.default_sorter,e},default_sorter:function(i,t){return i.cost-t.cost},push:function(i,t){var e={value:i,cost:t};this.queue.push(e),this.queue.sort(this.sorter)},pop:function(){return this.queue.shift()},empty:function(){return this.queue.length===0}}};typeof Ts<"u"&&(Ts.exports=Vn)});var Na=st(hn=>{var et=ge(),Ca=_a(),Pa=va(),Ia=Ma(),Ra=Ea(),Hn=vs(),er=pe(),Vd=Ta();function wa(i){return unescape(encodeURIComponent(i)).length}function Gn(i,t,e){let r=[],o;for(;(o=i.exec(e))!==null;)r.push({data:o[0],index:o.index,mode:t,length:o[0].length});return r}function La(i){let t=Gn(Hn.NUMERIC,et.NUMERIC,i),e=Gn(Hn.ALPHANUMERIC,et.ALPHANUMERIC,i),r,o;return er.isKanjiModeEnabled()?(r=Gn(Hn.BYTE,et.BYTE,i),o=Gn(Hn.KANJI,et.KANJI,i)):(r=Gn(Hn.BYTE_KANJI,et.BYTE,i),o=[]),t.concat(e,r,o).sort(function(c,f){return c.index-f.index}).map(function(c){return{data:c.data,mode:c.mode,length:c.length}})}function ws(i,t){switch(t){case et.NUMERIC:return Ca.getBitsLength(i);case et.ALPHANUMERIC:return Pa.getBitsLength(i);case et.KANJI:return Ra.getBitsLength(i);case et.BYTE:return Ia.getBitsLength(i)}}function Hd(i){return i.reduce(function(t,e){let r=t.length-1>=0?t[t.length-1]:null;return r&&r.mode===e.mode?(t[t.length-1].data+=e.data,t):(t.push(e),t)},[])}function Gd(i){let t=[];for(let e=0;e<i.length;e++){let r=i[e];switch(r.mode){case et.NUMERIC:t.push([r,{data:r.data,mode:et.ALPHANUMERIC,length:r.length},{data:r.data,mode:et.BYTE,length:r.length}]);break;case et.ALPHANUMERIC:t.push([r,{data:r.data,mode:et.BYTE,length:r.length}]);break;case et.KANJI:t.push([r,{data:r.data,mode:et.BYTE,length:wa(r.data)}]);break;case et.BYTE:t.push([{data:r.data,mode:et.BYTE,length:wa(r.data)}])}}return t}function Xd(i,t){let e={},r={start:{}},o=["start"];for(let l=0;l<i.length;l++){let c=i[l],f=[];for(let h=0;h<c.length;h++){let p=c[h],m=""+l+h;f.push(m),e[m]={node:p,lastCount:0},r[m]={};for(let x=0;x<o.length;x++){let _=o[x];e[_]&&e[_].node.mode===p.mode?(r[_][m]=ws(e[_].lastCount+p.length,p.mode)-ws(e[_].lastCount,p.mode),e[_].lastCount+=p.length):(e[_]&&(e[_].lastCount=p.length),r[_][m]=ws(p.length,p.mode)+4+et.getCharCountIndicator(p.mode,t))}}o=f}for(let l=0;l<o.length;l++)r[o[l]].end=0;return{map:r,table:e}}function Aa(i,t){let e,r=et.getBestModeForData(i);if(e=et.from(t,r),e!==et.BYTE&&e.bit<r.bit)throw new Error('"'+i+'" cannot be encoded with mode '+et.toString(e)+`.
 Suggested mode is: `+et.toString(r));switch(e===et.KANJI&&!er.isKanjiModeEnabled()&&(e=et.BYTE),e){case et.NUMERIC:return new Ca(i);case et.ALPHANUMERIC:return new Pa(i);case et.KANJI:return new Ra(i);case et.BYTE:return new Ia(i)}}hn.fromArray=function(t){return t.reduce(function(e,r){return typeof r=="string"?e.push(Aa(r,null)):r.data&&e.push(Aa(r.data,r.mode)),e},[])};hn.fromString=function(t,e){let r=La(t,er.isKanjiModeEnabled()),o=Gd(r),l=Xd(o,e),c=Vd.find_path(l.map,"start","end"),f=[];for(let h=1;h<c.length-1;h++)f.push(l.table[c[h]].node);return hn.fromArray(Hd(f))};hn.rawSplit=function(t){return hn.fromArray(La(t,er.isKanjiModeEnabled()))}});var Oa=st(Da=>{var ir=pe(),As=Zi(),Wd=qo(),Yd=Jo(),qd=Ko(),Zd=Qo(),Is=ta(),Rs=gs(),Jd=sa(),nr=fa(),Kd=ga(),$d=ge(),Cs=Na();function jd(i,t){let e=i.size,r=Zd.getPositions(t);for(let o=0;o<r.length;o++){let l=r[o][0],c=r[o][1];for(let f=-1;f<=7;f++)if(!(l+f<=-1||e<=l+f))for(let h=-1;h<=7;h++)c+h<=-1||e<=c+h||(f>=0&&f<=6&&(h===0||h===6)||h>=0&&h<=6&&(f===0||f===6)||f>=2&&f<=4&&h>=2&&h<=4?i.set(l+f,c+h,!0,!0):i.set(l+f,c+h,!1,!0))}}function Qd(i){let t=i.size;for(let e=8;e<t-8;e++){let r=e%2===0;i.set(e,6,r,!0),i.set(6,e,r,!0)}}function tp(i,t){let e=qd.getPositions(t);for(let r=0;r<e.length;r++){let o=e[r][0],l=e[r][1];for(let c=-2;c<=2;c++)for(let f=-2;f<=2;f++)c===-2||c===2||f===-2||f===2||c===0&&f===0?i.set(o+c,l+f,!0,!0):i.set(o+c,l+f,!1,!0)}}function ep(i,t){let e=i.size,r=nr.getEncodedBits(t),o,l,c;for(let f=0;f<18;f++)o=Math.floor(f/3),l=f%3+e-8-3,c=(r>>f&1)===1,i.set(o,l,c,!0),i.set(l,o,c,!0)}function Ps(i,t,e){let r=i.size,o=Kd.getEncodedBits(t,e),l,c;for(l=0;l<15;l++)c=(o>>l&1)===1,l<6?i.set(l,8,c,!0):l<8?i.set(l+1,8,c,!0):i.set(r-15+l,8,c,!0),l<8?i.set(8,r-l-1,c,!0):l<9?i.set(8,15-l-1+1,c,!0):i.set(8,15-l-1,c,!0);i.set(r-8,8,1,!0)}function np(i,t){let e=i.size,r=-1,o=e-1,l=7,c=0;for(let f=e-1;f>0;f-=2)for(f===6&&f--;;){for(let h=0;h<2;h++)if(!i.isReserved(o,f-h)){let p=!1;c<t.length&&(p=(t[c]>>>l&1)===1),i.set(o,f-h,p),l--,l===-1&&(c++,l=7)}if(o+=r,o<0||e<=o){o-=r,r=-r;break}}}function ip(i,t,e){let r=new Wd;e.forEach(function(h){r.put(h.mode.bit,4),r.put(h.getLength(),$d.getCharCountIndicator(h.mode,i)),h.write(r)});let o=ir.getSymbolTotalCodewords(i),l=Rs.getTotalCodewordsCount(i,t),c=(o-l)*8;for(r.getLengthInBits()+4<=c&&r.put(0,4);r.getLengthInBits()%8!==0;)r.putBit(0);let f=(c-r.getLengthInBits())/8;for(let h=0;h<f;h++)r.put(h%2?17:236,8);return rp(r,i,t)}function rp(i,t,e){let r=ir.getSymbolTotalCodewords(t),o=Rs.getTotalCodewordsCount(t,e),l=r-o,c=Rs.getBlocksCount(t,e),f=r%c,h=c-f,p=Math.floor(r/c),m=Math.floor(l/c),x=m+1,_=p-m,v=new Jd(_),S=0,E=new Array(c),w=new Array(c),P=0,N=new Uint8Array(i.buffer);for(let z=0;z<c;z++){let O=z<h?m:x;E[z]=N.slice(S,S+O),w[z]=v.encode(E[z]),S+=O,P=Math.max(P,O)}let C=new Uint8Array(r),I=0,D,B;for(D=0;D<P;D++)for(B=0;B<c;B++)D<E[B].length&&(C[I++]=E[B][D]);for(D=0;D<_;D++)for(B=0;B<c;B++)C[I++]=w[B][D];return C}function sp(i,t,e,r){let o;if(Array.isArray(i))o=Cs.fromArray(i);else if(typeof i=="string"){let p=t;if(!p){let m=Cs.rawSplit(i);p=nr.getBestVersionForData(m,e)}o=Cs.fromString(i,p||40)}else throw new Error("Invalid data");let l=nr.getBestVersionForData(o,e);if(!l)throw new Error("The amount of data is too big to be stored in a QR Code");if(!t)t=l;else if(t<l)throw new Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+l+`.
`);let c=ip(t,e,o),f=ir.getSymbolSize(t),h=new Yd(f);return jd(h,t),Qd(h),tp(h,t),Ps(h,e,0),t>=7&&ep(h,t),np(h,c),isNaN(r)&&(r=Is.getBestMask(h,Ps.bind(null,h,e))),Is.applyMask(r,h),Ps(h,e,r),{modules:h,version:t,errorCorrectionLevel:e,maskPattern:r,segments:o}}Da.create=function(t,e){if(typeof t>"u"||t==="")throw new Error("No input text");let r=As.M,o,l;return typeof e<"u"&&(r=As.from(e.errorCorrectionLevel,As.M),o=nr.from(e.version),l=Is.from(e.maskPattern),e.toSJISFunc&&ir.setToSJISFunction(e.toSJISFunc)),sp(t,o,r,l)}});var ao=1;var lo=3,Gi=0,co=1;var uo=1;var ho=100;var fo=204,po=205;var Pr=0,Ir=1,Rr=2,_i=3,Lr=4,Nr=5,Dr=6,Or=7,$r=0,mo=1,go=2;var jr=1,Qr=2,ts=3,es=4,ns=5,is=6,rs=7;var ss=300,xo=301,os=302;var _o=306,Fr=1e3,yn=1001,Br=1002;var yo=1006;var vo=1008;var So=1009;var Mo=1015;var bo=1023;var En=2300,yi=2301,mi=2302,Ur=2303,zr=2400,kr=2401,Vr=2402;var as="",Nt="srgb",Hr="srgb-linear",Gr="linear",gi="srgb";var xi=7680;var Eo=519;var To=35044;var vn=2e3,Xr=2001;function uc(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function hc(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function Wr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}var Bs={},vi=null;function wo(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function ht(...i){i=wo(i);let t="THREE."+i.shift();if(vi)vi("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function ot(...i){i=wo(i);let t="THREE."+i.shift();if(vi)vi("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function Ze(...i){let t=i.join(" ");t in Bs||(Bs[t]=!0,ht(...i))}var fc={[Pr]:Ir,[Rr]:Dr,[Lr]:Or,[_i]:Nr,[Ir]:Pr,[Dr]:Rr,[Or]:Lr,[Nr]:_i},le=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let r=this._listeners;r[t]===void 0&&(r[t]=[]),r[t].indexOf(e)===-1&&r[t].push(e)}hasEventListener(t,e){let r=this._listeners;return r===void 0?!1:r[t]!==void 0&&r[t].indexOf(e)!==-1}removeEventListener(t,e){let r=this._listeners;if(r===void 0)return;let o=r[t];if(o!==void 0){let l=o.indexOf(e);l!==-1&&o.splice(l,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let r=e[t.type];if(r!==void 0){t.target=this;let o=r.slice(0);for(let l=0,c=o.length;l<c;l++)o[l].call(this,t);t.target=null}}},_t=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var pp=Math.PI/180,dc=180/Math.PI;function sn(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(_t[i&255]+_t[i>>8&255]+_t[i>>16&255]+_t[i>>24&255]+"-"+_t[t&255]+_t[t>>8&255]+"-"+_t[t>>16&15|64]+_t[t>>24&255]+"-"+_t[e&63|128]+_t[e>>8&255]+"-"+_t[e>>16&255]+_t[e>>24&255]+_t[r&255]+_t[r>>8&255]+_t[r>>16&255]+_t[r>>24&255]).toLowerCase()}function $(i,t,e){return Math.max(t,Math.min(e,i))}function pc(i,t){return(i%t+t)%t}function sr(i,t,e){return(1-e)*i+e*t}function pn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Et(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var V=class i{static{i.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,r=this.y,o=t.elements;return this.x=o[0]*e+o[3]*r+o[6],this.y=o[1]*e+o[4]*r+o[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=$(this.x,t.x,e.x),this.y=$(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=$(this.x,t,e),this.y=$(this.y,t,e),this}clampLength(t,e){let r=this.length();return this.divideScalar(r||1).multiplyScalar($(r,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let r=this.dot(t)/e;return Math.acos($(r,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,r=this.y-t.y;return e*e+r*r}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,r){return this.x=t.x+(e.x-t.x)*r,this.y=t.y+(e.y-t.y)*r,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let r=Math.cos(e),o=Math.sin(e),l=this.x-t.x,c=this.y-t.y;return this.x=l*r-c*o+t.x,this.y=l*o+c*r+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},jt=class{constructor(t=0,e=0,r=0,o=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=r,this._w=o}static slerpFlat(t,e,r,o,l,c,f){let h=r[o+0],p=r[o+1],m=r[o+2],x=r[o+3],_=l[c+0],v=l[c+1],S=l[c+2],E=l[c+3];if(x!==E||h!==_||p!==v||m!==S){let w=h*_+p*v+m*S+x*E;w<0&&(_=-_,v=-v,S=-S,E=-E,w=-w);let P=1-f;if(w<.9995){let N=Math.acos(w),C=Math.sin(N);P=Math.sin(P*N)/C,f=Math.sin(f*N)/C,h=h*P+_*f,p=p*P+v*f,m=m*P+S*f,x=x*P+E*f}else{h=h*P+_*f,p=p*P+v*f,m=m*P+S*f,x=x*P+E*f;let N=1/Math.sqrt(h*h+p*p+m*m+x*x);h*=N,p*=N,m*=N,x*=N}}t[e]=h,t[e+1]=p,t[e+2]=m,t[e+3]=x}static multiplyQuaternionsFlat(t,e,r,o,l,c){let f=r[o],h=r[o+1],p=r[o+2],m=r[o+3],x=l[c],_=l[c+1],v=l[c+2],S=l[c+3];return t[e]=f*S+m*x+h*v-p*_,t[e+1]=h*S+m*_+p*x-f*v,t[e+2]=p*S+m*v+f*_-h*x,t[e+3]=m*S-f*x-h*_-p*v,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,r,o){return this._x=t,this._y=e,this._z=r,this._w=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let r=t._x,o=t._y,l=t._z,c=t._order,f=Math.cos,h=Math.sin,p=f(r/2),m=f(o/2),x=f(l/2),_=h(r/2),v=h(o/2),S=h(l/2);switch(c){case"XYZ":this._x=_*m*x+p*v*S,this._y=p*v*x-_*m*S,this._z=p*m*S+_*v*x,this._w=p*m*x-_*v*S;break;case"YXZ":this._x=_*m*x+p*v*S,this._y=p*v*x-_*m*S,this._z=p*m*S-_*v*x,this._w=p*m*x+_*v*S;break;case"ZXY":this._x=_*m*x-p*v*S,this._y=p*v*x+_*m*S,this._z=p*m*S+_*v*x,this._w=p*m*x-_*v*S;break;case"ZYX":this._x=_*m*x-p*v*S,this._y=p*v*x+_*m*S,this._z=p*m*S-_*v*x,this._w=p*m*x+_*v*S;break;case"YZX":this._x=_*m*x+p*v*S,this._y=p*v*x+_*m*S,this._z=p*m*S-_*v*x,this._w=p*m*x-_*v*S;break;case"XZY":this._x=_*m*x-p*v*S,this._y=p*v*x-_*m*S,this._z=p*m*S+_*v*x,this._w=p*m*x+_*v*S;break;default:ht("Quaternion: .setFromEuler() encountered an unknown order: "+c)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let r=e/2,o=Math.sin(r);return this._x=t.x*o,this._y=t.y*o,this._z=t.z*o,this._w=Math.cos(r),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,r=e[0],o=e[4],l=e[8],c=e[1],f=e[5],h=e[9],p=e[2],m=e[6],x=e[10],_=r+f+x;if(_>0){let v=.5/Math.sqrt(_+1);this._w=.25/v,this._x=(m-h)*v,this._y=(l-p)*v,this._z=(c-o)*v}else if(r>f&&r>x){let v=2*Math.sqrt(1+r-f-x);this._w=(m-h)/v,this._x=.25*v,this._y=(o+c)/v,this._z=(l+p)/v}else if(f>x){let v=2*Math.sqrt(1+f-r-x);this._w=(l-p)/v,this._x=(o+c)/v,this._y=.25*v,this._z=(h+m)/v}else{let v=2*Math.sqrt(1+x-r-f);this._w=(c-o)/v,this._x=(l+p)/v,this._y=(h+m)/v,this._z=.25*v}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let r=t.dot(e)+1;return r<1e-8?(r=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=r):(this._x=0,this._y=-t.z,this._z=t.y,this._w=r)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=r),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs($(this.dot(t),-1,1)))}rotateTowards(t,e){let r=this.angleTo(t);if(r===0)return this;let o=Math.min(1,e/r);return this.slerp(t,o),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let r=t._x,o=t._y,l=t._z,c=t._w,f=e._x,h=e._y,p=e._z,m=e._w;return this._x=r*m+c*f+o*p-l*h,this._y=o*m+c*h+l*f-r*p,this._z=l*m+c*p+r*h-o*f,this._w=c*m-r*f-o*h-l*p,this._onChangeCallback(),this}slerp(t,e){let r=t._x,o=t._y,l=t._z,c=t._w,f=this.dot(t);f<0&&(r=-r,o=-o,l=-l,c=-c,f=-f);let h=1-e;if(f<.9995){let p=Math.acos(f),m=Math.sin(p);h=Math.sin(h*p)/m,e=Math.sin(e*p)/m,this._x=this._x*h+r*e,this._y=this._y*h+o*e,this._z=this._z*h+l*e,this._w=this._w*h+c*e,this._onChangeCallback()}else this._x=this._x*h+r*e,this._y=this._y*h+o*e,this._z=this._z*h+l*e,this._w=this._w*h+c*e,this.normalize();return this}slerpQuaternions(t,e,r){return this.copy(t).slerp(e,r)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),r=Math.random(),o=Math.sqrt(1-r),l=Math.sqrt(r);return this.set(o*Math.sin(t),o*Math.cos(t),l*Math.sin(e),l*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},T=class i{static{i.prototype.isVector3=!0}constructor(t=0,e=0,r=0){this.x=t,this.y=e,this.z=r}set(t,e,r){return r===void 0&&(r=this.z),this.x=t,this.y=e,this.z=r,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Us.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Us.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,r=this.y,o=this.z,l=t.elements;return this.x=l[0]*e+l[3]*r+l[6]*o,this.y=l[1]*e+l[4]*r+l[7]*o,this.z=l[2]*e+l[5]*r+l[8]*o,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,r=this.y,o=this.z,l=t.elements,c=1/(l[3]*e+l[7]*r+l[11]*o+l[15]);return this.x=(l[0]*e+l[4]*r+l[8]*o+l[12])*c,this.y=(l[1]*e+l[5]*r+l[9]*o+l[13])*c,this.z=(l[2]*e+l[6]*r+l[10]*o+l[14])*c,this}applyQuaternion(t){let e=this.x,r=this.y,o=this.z,l=t.x,c=t.y,f=t.z,h=t.w,p=2*(c*o-f*r),m=2*(f*e-l*o),x=2*(l*r-c*e);return this.x=e+h*p+c*x-f*m,this.y=r+h*m+f*p-l*x,this.z=o+h*x+l*m-c*p,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,r=this.y,o=this.z,l=t.elements;return this.x=l[0]*e+l[4]*r+l[8]*o,this.y=l[1]*e+l[5]*r+l[9]*o,this.z=l[2]*e+l[6]*r+l[10]*o,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=$(this.x,t.x,e.x),this.y=$(this.y,t.y,e.y),this.z=$(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=$(this.x,t,e),this.y=$(this.y,t,e),this.z=$(this.z,t,e),this}clampLength(t,e){let r=this.length();return this.divideScalar(r||1).multiplyScalar($(r,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,r){return this.x=t.x+(e.x-t.x)*r,this.y=t.y+(e.y-t.y)*r,this.z=t.z+(e.z-t.z)*r,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let r=t.x,o=t.y,l=t.z,c=e.x,f=e.y,h=e.z;return this.x=o*h-l*f,this.y=l*c-r*h,this.z=r*f-o*c,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let r=t.dot(this)/e;return this.copy(t).multiplyScalar(r)}projectOnPlane(t){return or.copy(this).projectOnVector(t),this.sub(or)}reflect(t){return this.sub(or.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let r=this.dot(t)/e;return Math.acos($(r,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,r=this.y-t.y,o=this.z-t.z;return e*e+r*r+o*o}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,r){let o=Math.sin(e)*t;return this.x=o*Math.sin(r),this.y=Math.cos(e)*t,this.z=o*Math.cos(r),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,r){return this.x=t*Math.sin(e),this.y=r,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),r=this.setFromMatrixColumn(t,1).length(),o=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=r,this.z=o,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,r=Math.sqrt(1-e*e);return this.x=r*Math.cos(t),this.y=e,this.z=r*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},or=new T,Us=new jt,q=class i{static{i.prototype.isMatrix3=!0}constructor(t,e,r,o,l,c,f,h,p){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,r,o,l,c,f,h,p)}set(t,e,r,o,l,c,f,h,p){let m=this.elements;return m[0]=t,m[1]=o,m[2]=f,m[3]=e,m[4]=l,m[5]=h,m[6]=r,m[7]=c,m[8]=p,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,r=t.elements;return e[0]=r[0],e[1]=r[1],e[2]=r[2],e[3]=r[3],e[4]=r[4],e[5]=r[5],e[6]=r[6],e[7]=r[7],e[8]=r[8],this}extractBasis(t,e,r){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),r.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let r=t.elements,o=e.elements,l=this.elements,c=r[0],f=r[3],h=r[6],p=r[1],m=r[4],x=r[7],_=r[2],v=r[5],S=r[8],E=o[0],w=o[3],P=o[6],N=o[1],C=o[4],I=o[7],D=o[2],B=o[5],z=o[8];return l[0]=c*E+f*N+h*D,l[3]=c*w+f*C+h*B,l[6]=c*P+f*I+h*z,l[1]=p*E+m*N+x*D,l[4]=p*w+m*C+x*B,l[7]=p*P+m*I+x*z,l[2]=_*E+v*N+S*D,l[5]=_*w+v*C+S*B,l[8]=_*P+v*I+S*z,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],r=t[1],o=t[2],l=t[3],c=t[4],f=t[5],h=t[6],p=t[7],m=t[8];return e*c*m-e*f*p-r*l*m+r*f*h+o*l*p-o*c*h}invert(){let t=this.elements,e=t[0],r=t[1],o=t[2],l=t[3],c=t[4],f=t[5],h=t[6],p=t[7],m=t[8],x=m*c-f*p,_=f*h-m*l,v=p*l-c*h,S=e*x+r*_+o*v;if(S===0)return this.set(0,0,0,0,0,0,0,0,0);let E=1/S;return t[0]=x*E,t[1]=(o*p-m*r)*E,t[2]=(f*r-o*c)*E,t[3]=_*E,t[4]=(m*e-o*h)*E,t[5]=(o*l-f*e)*E,t[6]=v*E,t[7]=(r*h-p*e)*E,t[8]=(c*e-r*l)*E,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,r,o,l,c,f){let h=Math.cos(l),p=Math.sin(l);return this.set(r*h,r*p,-r*(h*c+p*f)+c+t,-o*p,o*h,-o*(-p*c+h*f)+f+e,0,0,1),this}scale(t,e){return Ze("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(ar.makeScale(t,e)),this}rotate(t){return Ze("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(ar.makeRotation(-t)),this}translate(t,e){return Ze("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(ar.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),r=Math.sin(t);return this.set(e,-r,0,r,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,r=t.elements;for(let o=0;o<9;o++)if(e[o]!==r[o])return!1;return!0}fromArray(t,e=0){for(let r=0;r<9;r++)this.elements[r]=t[r+e];return this}toArray(t=[],e=0){let r=this.elements;return t[e]=r[0],t[e+1]=r[1],t[e+2]=r[2],t[e+3]=r[3],t[e+4]=r[4],t[e+5]=r[5],t[e+6]=r[6],t[e+7]=r[7],t[e+8]=r[8],t}clone(){return new this.constructor().fromArray(this.elements)}},ar=new q,zs=new q().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ks=new q().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function mc(){let i={enabled:!0,workingColorSpace:Hr,spaces:{},convert:function(o,l,c){return this.enabled===!1||l===c||!l||!c||(this.spaces[l].transfer===gi&&(o.r=$t(o.r),o.g=$t(o.g),o.b=$t(o.b)),this.spaces[l].primaries!==this.spaces[c].primaries&&(o.applyMatrix3(this.spaces[l].toXYZ),o.applyMatrix3(this.spaces[c].fromXYZ)),this.spaces[c].transfer===gi&&(o.r=Je(o.r),o.g=Je(o.g),o.b=Je(o.b))),o},workingToColorSpace:function(o,l){return this.convert(o,this.workingColorSpace,l)},colorSpaceToWorking:function(o,l){return this.convert(o,l,this.workingColorSpace)},getPrimaries:function(o){return this.spaces[o].primaries},getTransfer:function(o){return o===as?Gr:this.spaces[o].transfer},getToneMappingMode:function(o){return this.spaces[o].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(o,l=this.workingColorSpace){return o.fromArray(this.spaces[l].luminanceCoefficients)},define:function(o){Object.assign(this.spaces,o)},_getMatrix:function(o,l,c){return o.copy(this.spaces[l].toXYZ).multiply(this.spaces[c].fromXYZ)},_getDrawingBufferColorSpace:function(o){return this.spaces[o].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(o=this.workingColorSpace){return this.spaces[o].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(o,l){return Ze("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(o,l)},toWorkingColorSpace:function(o,l){return Ze("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(o,l)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],r=[.3127,.329];return i.define({[Hr]:{primaries:t,whitePoint:r,transfer:Gr,toXYZ:zs,fromXYZ:ks,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Nt},outputColorSpaceConfig:{drawingBufferColorSpace:Nt}},[Nt]:{primaries:t,whitePoint:r,transfer:gi,toXYZ:zs,fromXYZ:ks,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Nt}}}),i}var Lt=mc();function $t(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Je(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Be,Si=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let r;if(t instanceof HTMLCanvasElement)r=t;else{Be===void 0&&(Be=Wr("canvas")),Be.width=t.width,Be.height=t.height;let o=Be.getContext("2d");t instanceof ImageData?o.putImageData(t,0,0):o.drawImage(t,0,0,t.width,t.height),r=Be}return r.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=Wr("canvas");e.width=t.width,e.height=t.height;let r=e.getContext("2d");r.drawImage(t,0,0,t.width,t.height);let o=r.getImageData(0,0,t.width,t.height),l=o.data;for(let c=0;c<l.length;c++)l[c]=$t(l[c]/255)*255;return r.putImageData(o,0,0),e}else if(t.data){let e=t.data.slice(0);for(let r=0;r<e.length;r++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[r]=Math.floor($t(e[r]/255)*255):e[r]=$t(e[r]);return{data:e,width:t.width,height:t.height}}else return ht("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},gc=0,Mi=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:gc++}),this.uuid=sn(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let r={uuid:this.uuid,url:""},o=this.data;if(o!==null){let l;if(Array.isArray(o)){l=[];for(let c=0,f=o.length;c<f;c++)o[c].isDataTexture?l.push(lr(o[c].image)):l.push(lr(o[c]))}else l=lr(o);r.url=l}return e||(t.images[this.uuid]=r),r}};function lr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Si.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(ht("Texture: Unable to serialize Texture."),{})}var xc=0,cr=new T,Ke=class i extends le{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,r=yn,o=yn,l=yo,c=vo,f=bo,h=So,p=i.DEFAULT_ANISOTROPY,m=as){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xc++}),this.uuid=sn(),this.name="",this.source=new Mi(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=r,this.wrapT=o,this.magFilter=l,this.minFilter=c,this.anisotropy=p,this.format=f,this.internalFormat=null,this.type=h,this.offset=new V(0,0),this.repeat=new V(1,1),this.center=new V(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new q,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=m,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(cr).x}get height(){return this.source.getSize(cr).y}get depth(){return this.source.getSize(cr).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let r=t[e];if(r===void 0){ht(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let o=this[e];if(o===void 0){ht(`Texture.setValues(): property '${e}' does not exist.`);continue}o&&r&&o.isVector2&&r.isVector2||o&&r&&o.isVector3&&r.isVector3||o&&r&&o.isMatrix3&&r.isMatrix3?o.copy(r):this[e]=r}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let r={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(r.userData=this.userData),e||(t.textures[this.uuid]=r),r}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==ss)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Fr:t.x=t.x-Math.floor(t.x);break;case yn:t.x=t.x<0?0:1;break;case Br:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Fr:t.y=t.y-Math.floor(t.y);break;case yn:t.y=t.y<0?0:1;break;case Br:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Ke.DEFAULT_IMAGE=null;Ke.DEFAULT_MAPPING=ss;Ke.DEFAULT_ANISOTROPY=1;var $e=class i{static{i.prototype.isVector4=!0}constructor(t=0,e=0,r=0,o=1){this.x=t,this.y=e,this.z=r,this.w=o}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,r,o){return this.x=t,this.y=e,this.z=r,this.w=o,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,r=this.y,o=this.z,l=this.w,c=t.elements;return this.x=c[0]*e+c[4]*r+c[8]*o+c[12]*l,this.y=c[1]*e+c[5]*r+c[9]*o+c[13]*l,this.z=c[2]*e+c[6]*r+c[10]*o+c[14]*l,this.w=c[3]*e+c[7]*r+c[11]*o+c[15]*l,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,r,o,l,h=t.elements,p=h[0],m=h[4],x=h[8],_=h[1],v=h[5],S=h[9],E=h[2],w=h[6],P=h[10];if(Math.abs(m-_)<.01&&Math.abs(x-E)<.01&&Math.abs(S-w)<.01){if(Math.abs(m+_)<.1&&Math.abs(x+E)<.1&&Math.abs(S+w)<.1&&Math.abs(p+v+P-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let C=(p+1)/2,I=(v+1)/2,D=(P+1)/2,B=(m+_)/4,z=(x+E)/4,O=(S+w)/4;return C>I&&C>D?C<.01?(r=0,o=.707106781,l=.707106781):(r=Math.sqrt(C),o=B/r,l=z/r):I>D?I<.01?(r=.707106781,o=0,l=.707106781):(o=Math.sqrt(I),r=B/o,l=O/o):D<.01?(r=.707106781,o=.707106781,l=0):(l=Math.sqrt(D),r=z/l,o=O/l),this.set(r,o,l,e),this}let N=Math.sqrt((w-S)*(w-S)+(x-E)*(x-E)+(_-m)*(_-m));return Math.abs(N)<.001&&(N=1),this.x=(w-S)/N,this.y=(x-E)/N,this.z=(_-m)/N,this.w=Math.acos((p+v+P-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=$(this.x,t.x,e.x),this.y=$(this.y,t.y,e.y),this.z=$(this.z,t.z,e.z),this.w=$(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=$(this.x,t,e),this.y=$(this.y,t,e),this.z=$(this.z,t,e),this.w=$(this.w,t,e),this}clampLength(t,e){let r=this.length();return this.divideScalar(r||1).multiplyScalar($(r,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,r){return this.x=t.x+(e.x-t.x)*r,this.y=t.y+(e.y-t.y)*r,this.z=t.z+(e.z-t.z)*r,this.w=t.w+(e.w-t.w)*r,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};var lt=class i{static{i.prototype.isMatrix4=!0}constructor(t,e,r,o,l,c,f,h,p,m,x,_,v,S,E,w){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,r,o,l,c,f,h,p,m,x,_,v,S,E,w)}set(t,e,r,o,l,c,f,h,p,m,x,_,v,S,E,w){let P=this.elements;return P[0]=t,P[4]=e,P[8]=r,P[12]=o,P[1]=l,P[5]=c,P[9]=f,P[13]=h,P[2]=p,P[6]=m,P[10]=x,P[14]=_,P[3]=v,P[7]=S,P[11]=E,P[15]=w,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,r=t.elements;return e[0]=r[0],e[1]=r[1],e[2]=r[2],e[3]=r[3],e[4]=r[4],e[5]=r[5],e[6]=r[6],e[7]=r[7],e[8]=r[8],e[9]=r[9],e[10]=r[10],e[11]=r[11],e[12]=r[12],e[13]=r[13],e[14]=r[14],e[15]=r[15],this}copyPosition(t){let e=this.elements,r=t.elements;return e[12]=r[12],e[13]=r[13],e[14]=r[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,r){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),r.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),r.setFromMatrixColumn(this,2),this)}makeBasis(t,e,r){return this.set(t.x,e.x,r.x,0,t.y,e.y,r.y,0,t.z,e.z,r.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,r=t.elements,o=1/Ue.setFromMatrixColumn(t,0).length(),l=1/Ue.setFromMatrixColumn(t,1).length(),c=1/Ue.setFromMatrixColumn(t,2).length();return e[0]=r[0]*o,e[1]=r[1]*o,e[2]=r[2]*o,e[3]=0,e[4]=r[4]*l,e[5]=r[5]*l,e[6]=r[6]*l,e[7]=0,e[8]=r[8]*c,e[9]=r[9]*c,e[10]=r[10]*c,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,r=t.x,o=t.y,l=t.z,c=Math.cos(r),f=Math.sin(r),h=Math.cos(o),p=Math.sin(o),m=Math.cos(l),x=Math.sin(l);if(t.order==="XYZ"){let _=c*m,v=c*x,S=f*m,E=f*x;e[0]=h*m,e[4]=-h*x,e[8]=p,e[1]=v+S*p,e[5]=_-E*p,e[9]=-f*h,e[2]=E-_*p,e[6]=S+v*p,e[10]=c*h}else if(t.order==="YXZ"){let _=h*m,v=h*x,S=p*m,E=p*x;e[0]=_+E*f,e[4]=S*f-v,e[8]=c*p,e[1]=c*x,e[5]=c*m,e[9]=-f,e[2]=v*f-S,e[6]=E+_*f,e[10]=c*h}else if(t.order==="ZXY"){let _=h*m,v=h*x,S=p*m,E=p*x;e[0]=_-E*f,e[4]=-c*x,e[8]=S+v*f,e[1]=v+S*f,e[5]=c*m,e[9]=E-_*f,e[2]=-c*p,e[6]=f,e[10]=c*h}else if(t.order==="ZYX"){let _=c*m,v=c*x,S=f*m,E=f*x;e[0]=h*m,e[4]=S*p-v,e[8]=_*p+E,e[1]=h*x,e[5]=E*p+_,e[9]=v*p-S,e[2]=-p,e[6]=f*h,e[10]=c*h}else if(t.order==="YZX"){let _=c*h,v=c*p,S=f*h,E=f*p;e[0]=h*m,e[4]=E-_*x,e[8]=S*x+v,e[1]=x,e[5]=c*m,e[9]=-f*m,e[2]=-p*m,e[6]=v*x+S,e[10]=_-E*x}else if(t.order==="XZY"){let _=c*h,v=c*p,S=f*h,E=f*p;e[0]=h*m,e[4]=-x,e[8]=p*m,e[1]=_*x+E,e[5]=c*m,e[9]=v*x-S,e[2]=S*x-v,e[6]=f*m,e[10]=E*x+_}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(_c,t,yc)}lookAt(t,e,r){let o=this.elements;return At.subVectors(t,e),At.lengthSq()===0&&(At.z=1),At.normalize(),ie.crossVectors(r,At),ie.lengthSq()===0&&(Math.abs(r.z)===1?At.x+=1e-4:At.z+=1e-4,At.normalize(),ie.crossVectors(r,At)),ie.normalize(),$n.crossVectors(At,ie),o[0]=ie.x,o[4]=$n.x,o[8]=At.x,o[1]=ie.y,o[5]=$n.y,o[9]=At.y,o[2]=ie.z,o[6]=$n.z,o[10]=At.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let r=t.elements,o=e.elements,l=this.elements,c=r[0],f=r[4],h=r[8],p=r[12],m=r[1],x=r[5],_=r[9],v=r[13],S=r[2],E=r[6],w=r[10],P=r[14],N=r[3],C=r[7],I=r[11],D=r[15],B=o[0],z=o[4],O=o[8],X=o[12],k=o[1],H=o[5],Q=o[9],W=o[13],tt=o[2],Y=o[6],pt=o[10],xt=o[14],wt=o[3],kt=o[7],Vt=o[11],ne=o[15];return l[0]=c*B+f*k+h*tt+p*wt,l[4]=c*z+f*H+h*Y+p*kt,l[8]=c*O+f*Q+h*pt+p*Vt,l[12]=c*X+f*W+h*xt+p*ne,l[1]=m*B+x*k+_*tt+v*wt,l[5]=m*z+x*H+_*Y+v*kt,l[9]=m*O+x*Q+_*pt+v*Vt,l[13]=m*X+x*W+_*xt+v*ne,l[2]=S*B+E*k+w*tt+P*wt,l[6]=S*z+E*H+w*Y+P*kt,l[10]=S*O+E*Q+w*pt+P*Vt,l[14]=S*X+E*W+w*xt+P*ne,l[3]=N*B+C*k+I*tt+D*wt,l[7]=N*z+C*H+I*Y+D*kt,l[11]=N*O+C*Q+I*pt+D*Vt,l[15]=N*X+C*W+I*xt+D*ne,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],r=t[4],o=t[8],l=t[12],c=t[1],f=t[5],h=t[9],p=t[13],m=t[2],x=t[6],_=t[10],v=t[14],S=t[3],E=t[7],w=t[11],P=t[15],N=h*v-p*_,C=f*v-p*x,I=f*_-h*x,D=c*v-p*m,B=c*_-h*m,z=c*x-f*m;return e*(E*N-w*C+P*I)-r*(S*N-w*D+P*B)+o*(S*C-E*D+P*z)-l*(S*I-E*B+w*z)}determinantAffine(){let t=this.elements,e=t[0],r=t[4],o=t[8],l=t[1],c=t[5],f=t[9],h=t[2],p=t[6],m=t[10];return e*(c*m-f*p)-r*(l*m-f*h)+o*(l*p-c*h)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,r){let o=this.elements;return t.isVector3?(o[12]=t.x,o[13]=t.y,o[14]=t.z):(o[12]=t,o[13]=e,o[14]=r),this}invert(){let t=this.elements,e=t[0],r=t[1],o=t[2],l=t[3],c=t[4],f=t[5],h=t[6],p=t[7],m=t[8],x=t[9],_=t[10],v=t[11],S=t[12],E=t[13],w=t[14],P=t[15],N=e*f-r*c,C=e*h-o*c,I=e*p-l*c,D=r*h-o*f,B=r*p-l*f,z=o*p-l*h,O=m*E-x*S,X=m*w-_*S,k=m*P-v*S,H=x*w-_*E,Q=x*P-v*E,W=_*P-v*w,tt=N*W-C*Q+I*H+D*k-B*X+z*O;if(tt===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let Y=1/tt;return t[0]=(f*W-h*Q+p*H)*Y,t[1]=(o*Q-r*W-l*H)*Y,t[2]=(E*z-w*B+P*D)*Y,t[3]=(_*B-x*z-v*D)*Y,t[4]=(h*k-c*W-p*X)*Y,t[5]=(e*W-o*k+l*X)*Y,t[6]=(w*I-S*z-P*C)*Y,t[7]=(m*z-_*I+v*C)*Y,t[8]=(c*Q-f*k+p*O)*Y,t[9]=(r*k-e*Q-l*O)*Y,t[10]=(S*B-E*I+P*N)*Y,t[11]=(x*I-m*B-v*N)*Y,t[12]=(f*X-c*H-h*O)*Y,t[13]=(e*H-r*X+o*O)*Y,t[14]=(E*C-S*D-w*N)*Y,t[15]=(m*D-x*C+_*N)*Y,this}scale(t){let e=this.elements,r=t.x,o=t.y,l=t.z;return e[0]*=r,e[4]*=o,e[8]*=l,e[1]*=r,e[5]*=o,e[9]*=l,e[2]*=r,e[6]*=o,e[10]*=l,e[3]*=r,e[7]*=o,e[11]*=l,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],r=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],o=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,r,o))}makeTranslation(t,e,r){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,r,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),r=Math.sin(t);return this.set(1,0,0,0,0,e,-r,0,0,r,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),r=Math.sin(t);return this.set(e,0,r,0,0,1,0,0,-r,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),r=Math.sin(t);return this.set(e,-r,0,0,r,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let r=Math.cos(e),o=Math.sin(e),l=1-r,c=t.x,f=t.y,h=t.z,p=l*c,m=l*f;return this.set(p*c+r,p*f-o*h,p*h+o*f,0,p*f+o*h,m*f+r,m*h-o*c,0,p*h-o*f,m*h+o*c,l*h*h+r,0,0,0,0,1),this}makeScale(t,e,r){return this.set(t,0,0,0,0,e,0,0,0,0,r,0,0,0,0,1),this}makeShear(t,e,r,o,l,c){return this.set(1,r,l,0,t,1,c,0,e,o,1,0,0,0,0,1),this}compose(t,e,r){let o=this.elements,l=e._x,c=e._y,f=e._z,h=e._w,p=l+l,m=c+c,x=f+f,_=l*p,v=l*m,S=l*x,E=c*m,w=c*x,P=f*x,N=h*p,C=h*m,I=h*x,D=r.x,B=r.y,z=r.z;return o[0]=(1-(E+P))*D,o[1]=(v+I)*D,o[2]=(S-C)*D,o[3]=0,o[4]=(v-I)*B,o[5]=(1-(_+P))*B,o[6]=(w+N)*B,o[7]=0,o[8]=(S+C)*z,o[9]=(w-N)*z,o[10]=(1-(_+E))*z,o[11]=0,o[12]=t.x,o[13]=t.y,o[14]=t.z,o[15]=1,this}decompose(t,e,r){let o=this.elements;t.x=o[12],t.y=o[13],t.z=o[14];let l=this.determinantAffine();if(l===0)return r.set(1,1,1),e.identity(),this;let c=Ue.set(o[0],o[1],o[2]).length(),f=Ue.set(o[4],o[5],o[6]).length(),h=Ue.set(o[8],o[9],o[10]).length();l<0&&(c=-c),Bt.copy(this);let p=1/c,m=1/f,x=1/h;return Bt.elements[0]*=p,Bt.elements[1]*=p,Bt.elements[2]*=p,Bt.elements[4]*=m,Bt.elements[5]*=m,Bt.elements[6]*=m,Bt.elements[8]*=x,Bt.elements[9]*=x,Bt.elements[10]*=x,e.setFromRotationMatrix(Bt),r.x=c,r.y=f,r.z=h,this}makePerspective(t,e,r,o,l,c,f=vn,h=!1){let p=this.elements,m=2*l/(e-t),x=2*l/(r-o),_=(e+t)/(e-t),v=(r+o)/(r-o),S,E;if(h)S=l/(c-l),E=c*l/(c-l);else if(f===vn)S=-(c+l)/(c-l),E=-2*c*l/(c-l);else if(f===Xr)S=-c/(c-l),E=-c*l/(c-l);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+f);return p[0]=m,p[4]=0,p[8]=_,p[12]=0,p[1]=0,p[5]=x,p[9]=v,p[13]=0,p[2]=0,p[6]=0,p[10]=S,p[14]=E,p[3]=0,p[7]=0,p[11]=-1,p[15]=0,this}makeOrthographic(t,e,r,o,l,c,f=vn,h=!1){let p=this.elements,m=2/(e-t),x=2/(r-o),_=-(e+t)/(e-t),v=-(r+o)/(r-o),S,E;if(h)S=1/(c-l),E=c/(c-l);else if(f===vn)S=-2/(c-l),E=-(c+l)/(c-l);else if(f===Xr)S=-1/(c-l),E=-l/(c-l);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+f);return p[0]=m,p[4]=0,p[8]=0,p[12]=_,p[1]=0,p[5]=x,p[9]=0,p[13]=v,p[2]=0,p[6]=0,p[10]=S,p[14]=E,p[3]=0,p[7]=0,p[11]=0,p[15]=1,this}equals(t){let e=this.elements,r=t.elements;for(let o=0;o<16;o++)if(e[o]!==r[o])return!1;return!0}fromArray(t,e=0){for(let r=0;r<16;r++)this.elements[r]=t[r+e];return this}toArray(t=[],e=0){let r=this.elements;return t[e]=r[0],t[e+1]=r[1],t[e+2]=r[2],t[e+3]=r[3],t[e+4]=r[4],t[e+5]=r[5],t[e+6]=r[6],t[e+7]=r[7],t[e+8]=r[8],t[e+9]=r[9],t[e+10]=r[10],t[e+11]=r[11],t[e+12]=r[12],t[e+13]=r[13],t[e+14]=r[14],t[e+15]=r[15],t}},Ue=new T,Bt=new lt,_c=new T(0,0,0),yc=new T(1,1,1),ie=new T,$n=new T,At=new T,Vs=new lt,Hs=new jt,je=class i{constructor(t=0,e=0,r=0,o=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=r,this._order=o}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,r,o=this._order){return this._x=t,this._y=e,this._z=r,this._order=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,r=!0){let o=t.elements,l=o[0],c=o[4],f=o[8],h=o[1],p=o[5],m=o[9],x=o[2],_=o[6],v=o[10];switch(e){case"XYZ":this._y=Math.asin($(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(-m,v),this._z=Math.atan2(-c,l)):(this._x=Math.atan2(_,p),this._z=0);break;case"YXZ":this._x=Math.asin(-$(m,-1,1)),Math.abs(m)<.9999999?(this._y=Math.atan2(f,v),this._z=Math.atan2(h,p)):(this._y=Math.atan2(-x,l),this._z=0);break;case"ZXY":this._x=Math.asin($(_,-1,1)),Math.abs(_)<.9999999?(this._y=Math.atan2(-x,v),this._z=Math.atan2(-c,p)):(this._y=0,this._z=Math.atan2(h,l));break;case"ZYX":this._y=Math.asin(-$(x,-1,1)),Math.abs(x)<.9999999?(this._x=Math.atan2(_,v),this._z=Math.atan2(h,l)):(this._x=0,this._z=Math.atan2(-c,p));break;case"YZX":this._z=Math.asin($(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(-m,p),this._y=Math.atan2(-x,l)):(this._x=0,this._y=Math.atan2(f,v));break;case"XZY":this._z=Math.asin(-$(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(_,p),this._y=Math.atan2(f,l)):(this._x=Math.atan2(-m,v),this._y=0);break;default:ht("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,r===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,r){return Vs.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Vs,e,r)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Hs.setFromEuler(this),this.setFromQuaternion(Hs,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};je.DEFAULT_ORDER="XYZ";var bi=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},vc=0,Gs=new T,ze=new jt,Yt=new lt,jn=new T,mn=new T,Sc=new T,Mc=new jt,Xs=new T(1,0,0),Ws=new T(0,1,0),Ys=new T(0,0,1),qs={type:"added"},bc={type:"removed"},ke={type:"childadded",child:null},ur={type:"childremoved",child:null},ce=class i extends le{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:vc++}),this.uuid=sn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new T,e=new je,r=new jt,o=new T(1,1,1);function l(){r.setFromEuler(e,!1)}function c(){e.setFromQuaternion(r,void 0,!1)}e._onChange(l),r._onChange(c),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:o},modelViewMatrix:{value:new lt},normalMatrix:{value:new q}}),this.matrix=new lt,this.matrixWorld=new lt,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new bi,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ze.setFromAxisAngle(t,e),this.quaternion.multiply(ze),this}rotateOnWorldAxis(t,e){return ze.setFromAxisAngle(t,e),this.quaternion.premultiply(ze),this}rotateX(t){return this.rotateOnAxis(Xs,t)}rotateY(t){return this.rotateOnAxis(Ws,t)}rotateZ(t){return this.rotateOnAxis(Ys,t)}translateOnAxis(t,e){return Gs.copy(t).applyQuaternion(this.quaternion),this.position.add(Gs.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Xs,t)}translateY(t){return this.translateOnAxis(Ws,t)}translateZ(t){return this.translateOnAxis(Ys,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Yt.copy(this.matrixWorld).invert())}lookAt(t,e,r){t.isVector3?jn.copy(t):jn.set(t,e,r);let o=this.parent;this.updateWorldMatrix(!0,!1),mn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Yt.lookAt(mn,jn,this.up):Yt.lookAt(jn,mn,this.up),this.quaternion.setFromRotationMatrix(Yt),o&&(Yt.extractRotation(o.matrixWorld),ze.setFromRotationMatrix(Yt),this.quaternion.premultiply(ze.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(ot("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(qs),ke.child=t,this.dispatchEvent(ke),ke.child=null):ot("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let r=0;r<arguments.length;r++)this.remove(arguments[r]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(bc),ur.child=t,this.dispatchEvent(ur),ur.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Yt.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Yt.multiply(t.parent.matrixWorld)),t.applyMatrix4(Yt),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(qs),ke.child=t,this.dispatchEvent(ke),ke.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let r=0,o=this.children.length;r<o;r++){let c=this.children[r].getObjectByProperty(t,e);if(c!==void 0)return c}}getObjectsByProperty(t,e,r=[]){this[t]===e&&r.push(this);let o=this.children;for(let l=0,c=o.length;l<c;l++)o[l].getObjectsByProperty(t,e,r);return r}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mn,t,Sc),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mn,Mc,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let r=0,o=e.length;r<o;r++)e[r].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let r=0,o=e.length;r<o;r++)e[r].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,r=t.y,o=t.z,l=this.matrix.elements;l[12]+=e-l[0]*e-l[4]*r-l[8]*o,l[13]+=r-l[1]*e-l[5]*r-l[9]*o,l[14]+=o-l[2]*e-l[6]*r-l[10]*o}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let r=0,o=e.length;r<o;r++)e[r].updateMatrixWorld(t)}updateWorldMatrix(t,e,r=!1){let o=this.parent;if(t===!0&&o!==null&&o.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||r)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,r=!0),e===!0){let l=this.children;for(let c=0,f=l.length;c<f;c++)l[c].updateWorldMatrix(!1,!0,r)}}toJSON(t){let e=t===void 0||typeof t=="string",r={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},r.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let o={};o.uuid=this.uuid,o.type=this.type,o.name=this.name,o.castShadow=this.castShadow,o.receiveShadow=this.receiveShadow,o.visible=this.visible,o.frustumCulled=this.frustumCulled,o.renderOrder=this.renderOrder,o.static=this.static,o.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(o.userData=this.userData),o.layers=this.layers.mask,o.matrix=this.matrix.toArray(),o.up=this.up.toArray(),this.pivot!==null&&(o.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(o.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(o.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(o.type="InstancedMesh",o.count=this.count,o.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(o.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(o.type="BatchedMesh",o.perObjectFrustumCulled=this.perObjectFrustumCulled,o.sortObjects=this.sortObjects,o.drawRanges=this._drawRanges,o.reservedRanges=this._reservedRanges,o.geometryInfo=this._geometryInfo.map(f=>({...f,boundingBox:f.boundingBox?f.boundingBox.toJSON():void 0,boundingSphere:f.boundingSphere?f.boundingSphere.toJSON():void 0})),o.instanceInfo=this._instanceInfo.map(f=>({...f})),o.availableInstanceIds=this._availableInstanceIds.slice(),o.availableGeometryIds=this._availableGeometryIds.slice(),o.nextIndexStart=this._nextIndexStart,o.nextVertexStart=this._nextVertexStart,o.geometryCount=this._geometryCount,o.maxInstanceCount=this._maxInstanceCount,o.maxVertexCount=this._maxVertexCount,o.maxIndexCount=this._maxIndexCount,o.geometryInitialized=this._geometryInitialized,o.matricesTexture=this._matricesTexture.toJSON(t),o.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(o.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(o.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(o.boundingBox=this.boundingBox.toJSON()));function l(f,h){return f[h.uuid]===void 0&&(f[h.uuid]=h.toJSON(t)),h.uuid}if(this.isScene)this.background&&(this.background.isColor?o.background=this.background.toJSON():this.background.isTexture&&(o.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(o.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){o.geometry=l(t.geometries,this.geometry);let f=this.geometry.parameters;if(f!==void 0&&f.shapes!==void 0){let h=f.shapes;if(Array.isArray(h))for(let p=0,m=h.length;p<m;p++){let x=h[p];l(t.shapes,x)}else l(t.shapes,h)}}if(this.isSkinnedMesh&&(o.bindMode=this.bindMode,o.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(l(t.skeletons,this.skeleton),o.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let f=[];for(let h=0,p=this.material.length;h<p;h++)f.push(l(t.materials,this.material[h]));o.material=f}else o.material=l(t.materials,this.material);if(this.children.length>0){o.children=[];for(let f=0;f<this.children.length;f++)o.children.push(this.children[f].toJSON(t).object)}if(this.animations.length>0){o.animations=[];for(let f=0;f<this.animations.length;f++){let h=this.animations[f];o.animations.push(l(t.animations,h))}}if(e){let f=c(t.geometries),h=c(t.materials),p=c(t.textures),m=c(t.images),x=c(t.shapes),_=c(t.skeletons),v=c(t.animations),S=c(t.nodes);f.length>0&&(r.geometries=f),h.length>0&&(r.materials=h),p.length>0&&(r.textures=p),m.length>0&&(r.images=m),x.length>0&&(r.shapes=x),_.length>0&&(r.skeletons=_),v.length>0&&(r.animations=v),S.length>0&&(r.nodes=S)}return r.object=o,r;function c(f){let h=[];for(let p in f){let m=f[p];delete m.metadata,h.push(m)}return h}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let r=0;r<t.children.length;r++){let o=t.children[r];this.add(o.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};ce.DEFAULT_UP=new T(0,1,0);ce.DEFAULT_MATRIX_AUTO_UPDATE=!0;ce.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Ao={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},re={h:0,s:0,l:0},Qn={h:0,s:0,l:0};function hr(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var ut=class{constructor(t,e,r){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,r)}set(t,e,r){if(e===void 0&&r===void 0){let o=t;o&&o.isColor?this.copy(o):typeof o=="number"?this.setHex(o):typeof o=="string"&&this.setStyle(o)}else this.setRGB(t,e,r);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Nt){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Lt.colorSpaceToWorking(this,e),this}setRGB(t,e,r,o=Lt.workingColorSpace){return this.r=t,this.g=e,this.b=r,Lt.colorSpaceToWorking(this,o),this}setHSL(t,e,r,o=Lt.workingColorSpace){if(t=pc(t,1),e=$(e,0,1),r=$(r,0,1),e===0)this.r=this.g=this.b=r;else{let l=r<=.5?r*(1+e):r+e-r*e,c=2*r-l;this.r=hr(c,l,t+1/3),this.g=hr(c,l,t),this.b=hr(c,l,t-1/3)}return Lt.colorSpaceToWorking(this,o),this}setStyle(t,e=Nt){function r(l){l!==void 0&&parseFloat(l)<1&&ht("Color: Alpha component of "+t+" will be ignored.")}let o;if(o=/^(\w+)\(([^\)]*)\)/.exec(t)){let l,c=o[1],f=o[2];switch(c){case"rgb":case"rgba":if(l=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(f))return r(l[4]),this.setRGB(Math.min(255,parseInt(l[1],10))/255,Math.min(255,parseInt(l[2],10))/255,Math.min(255,parseInt(l[3],10))/255,e);if(l=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(f))return r(l[4]),this.setRGB(Math.min(100,parseInt(l[1],10))/100,Math.min(100,parseInt(l[2],10))/100,Math.min(100,parseInt(l[3],10))/100,e);break;case"hsl":case"hsla":if(l=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(f))return r(l[4]),this.setHSL(parseFloat(l[1])/360,parseFloat(l[2])/100,parseFloat(l[3])/100,e);break;default:ht("Color: Unknown color model "+t)}}else if(o=/^\#([A-Fa-f\d]+)$/.exec(t)){let l=o[1],c=l.length;if(c===3)return this.setRGB(parseInt(l.charAt(0),16)/15,parseInt(l.charAt(1),16)/15,parseInt(l.charAt(2),16)/15,e);if(c===6)return this.setHex(parseInt(l,16),e);ht("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Nt){let r=Ao[t.toLowerCase()];return r!==void 0?this.setHex(r,e):ht("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=$t(t.r),this.g=$t(t.g),this.b=$t(t.b),this}copyLinearToSRGB(t){return this.r=Je(t.r),this.g=Je(t.g),this.b=Je(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Nt){return Lt.workingToColorSpace(yt.copy(this),t),Math.round($(yt.r*255,0,255))*65536+Math.round($(yt.g*255,0,255))*256+Math.round($(yt.b*255,0,255))}getHexString(t=Nt){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Lt.workingColorSpace){Lt.workingToColorSpace(yt.copy(this),e);let r=yt.r,o=yt.g,l=yt.b,c=Math.max(r,o,l),f=Math.min(r,o,l),h,p,m=(f+c)/2;if(f===c)h=0,p=0;else{let x=c-f;switch(p=m<=.5?x/(c+f):x/(2-c-f),c){case r:h=(o-l)/x+(o<l?6:0);break;case o:h=(l-r)/x+2;break;case l:h=(r-o)/x+4;break}h/=6}return t.h=h,t.s=p,t.l=m,t}getRGB(t,e=Lt.workingColorSpace){return Lt.workingToColorSpace(yt.copy(this),e),t.r=yt.r,t.g=yt.g,t.b=yt.b,t}getStyle(t=Nt){Lt.workingToColorSpace(yt.copy(this),t);let e=yt.r,r=yt.g,o=yt.b;return t!==Nt?`color(${t} ${e.toFixed(3)} ${r.toFixed(3)} ${o.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(r*255)},${Math.round(o*255)})`}offsetHSL(t,e,r){return this.getHSL(re),this.setHSL(re.h+t,re.s+e,re.l+r)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,r){return this.r=t.r+(e.r-t.r)*r,this.g=t.g+(e.g-t.g)*r,this.b=t.b+(e.b-t.b)*r,this}lerpHSL(t,e){this.getHSL(re),t.getHSL(Qn);let r=sr(re.h,Qn.h,e),o=sr(re.s,Qn.s,e),l=sr(re.l,Qn.l,e);return this.setHSL(r,o,l),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,r=this.g,o=this.b,l=t.elements;return this.r=l[0]*e+l[3]*r+l[6]*o,this.g=l[1]*e+l[4]*r+l[7]*o,this.b=l[2]*e+l[5]*r+l[8]*o,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},yt=new ut;ut.NAMES=Ao;var Ut=new T,qt=new T,fr=new T,Zt=new T,Ve=new T,He=new T,Zs=new T,dr=new T,pr=new T,mr=new T,gr=new $e,xr=new $e,_r=new $e,ae=class i{constructor(t=new T,e=new T,r=new T){this.a=t,this.b=e,this.c=r}static getNormal(t,e,r,o){o.subVectors(r,e),Ut.subVectors(t,e),o.cross(Ut);let l=o.lengthSq();return l>0?o.multiplyScalar(1/Math.sqrt(l)):o.set(0,0,0)}static getBarycoord(t,e,r,o,l){Ut.subVectors(o,e),qt.subVectors(r,e),fr.subVectors(t,e);let c=Ut.dot(Ut),f=Ut.dot(qt),h=Ut.dot(fr),p=qt.dot(qt),m=qt.dot(fr),x=c*p-f*f;if(x===0)return l.set(0,0,0),null;let _=1/x,v=(p*h-f*m)*_,S=(c*m-f*h)*_;return l.set(1-v-S,S,v)}static containsPoint(t,e,r,o){return this.getBarycoord(t,e,r,o,Zt)===null?!1:Zt.x>=0&&Zt.y>=0&&Zt.x+Zt.y<=1}static getInterpolation(t,e,r,o,l,c,f,h){return this.getBarycoord(t,e,r,o,Zt)===null?(h.x=0,h.y=0,"z"in h&&(h.z=0),"w"in h&&(h.w=0),null):(h.setScalar(0),h.addScaledVector(l,Zt.x),h.addScaledVector(c,Zt.y),h.addScaledVector(f,Zt.z),h)}static getInterpolatedAttribute(t,e,r,o,l,c){return gr.setScalar(0),xr.setScalar(0),_r.setScalar(0),gr.fromBufferAttribute(t,e),xr.fromBufferAttribute(t,r),_r.fromBufferAttribute(t,o),c.setScalar(0),c.addScaledVector(gr,l.x),c.addScaledVector(xr,l.y),c.addScaledVector(_r,l.z),c}static isFrontFacing(t,e,r,o){return Ut.subVectors(r,e),qt.subVectors(t,e),Ut.cross(qt).dot(o)<0}set(t,e,r){return this.a.copy(t),this.b.copy(e),this.c.copy(r),this}setFromPointsAndIndices(t,e,r,o){return this.a.copy(t[e]),this.b.copy(t[r]),this.c.copy(t[o]),this}setFromAttributeAndIndices(t,e,r,o){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,r),this.c.fromBufferAttribute(t,o),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ut.subVectors(this.c,this.b),qt.subVectors(this.a,this.b),Ut.cross(qt).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,r,o,l){return i.getInterpolation(t,this.a,this.b,this.c,e,r,o,l)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let r=this.a,o=this.b,l=this.c,c,f;Ve.subVectors(o,r),He.subVectors(l,r),dr.subVectors(t,r);let h=Ve.dot(dr),p=He.dot(dr);if(h<=0&&p<=0)return e.copy(r);pr.subVectors(t,o);let m=Ve.dot(pr),x=He.dot(pr);if(m>=0&&x<=m)return e.copy(o);let _=h*x-m*p;if(_<=0&&h>=0&&m<=0)return c=h/(h-m),e.copy(r).addScaledVector(Ve,c);mr.subVectors(t,l);let v=Ve.dot(mr),S=He.dot(mr);if(S>=0&&v<=S)return e.copy(l);let E=v*p-h*S;if(E<=0&&p>=0&&S<=0)return f=p/(p-S),e.copy(r).addScaledVector(He,f);let w=m*S-v*x;if(w<=0&&x-m>=0&&v-S>=0)return Zs.subVectors(l,o),f=(x-m)/(x-m+(v-S)),e.copy(o).addScaledVector(Zs,f);let P=1/(w+E+_);return c=E*P,f=_*P,e.copy(r).addScaledVector(Ve,c).addScaledVector(He,f)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},Qt=class{constructor(t=new T(1/0,1/0,1/0),e=new T(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,r=t.length;e<r;e+=3)this.expandByPoint(zt.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,r=t.count;e<r;e++)this.expandByPoint(zt.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,r=t.length;e<r;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let r=zt.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(r),this.max.copy(t).add(r),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let r=t.geometry;if(r!==void 0){let l=r.getAttribute("position");if(e===!0&&l!==void 0&&t.isInstancedMesh!==!0)for(let c=0,f=l.count;c<f;c++)t.isMesh===!0?t.getVertexPosition(c,zt):zt.fromBufferAttribute(l,c),zt.applyMatrix4(t.matrixWorld),this.expandByPoint(zt);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ti.copy(t.boundingBox)):(r.boundingBox===null&&r.computeBoundingBox(),ti.copy(r.boundingBox)),ti.applyMatrix4(t.matrixWorld),this.union(ti)}let o=t.children;for(let l=0,c=o.length;l<c;l++)this.expandByObject(o[l],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,zt),zt.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,r;return t.normal.x>0?(e=t.normal.x*this.min.x,r=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,r=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,r+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,r+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,r+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,r+=t.normal.z*this.min.z),e<=-t.constant&&r>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(gn),ei.subVectors(this.max,gn),Ge.subVectors(t.a,gn),Xe.subVectors(t.b,gn),We.subVectors(t.c,gn),se.subVectors(Xe,Ge),oe.subVectors(We,Xe),Se.subVectors(Ge,We);let e=[0,-se.z,se.y,0,-oe.z,oe.y,0,-Se.z,Se.y,se.z,0,-se.x,oe.z,0,-oe.x,Se.z,0,-Se.x,-se.y,se.x,0,-oe.y,oe.x,0,-Se.y,Se.x,0];return!yr(e,Ge,Xe,We,ei)||(e=[1,0,0,0,1,0,0,0,1],!yr(e,Ge,Xe,We,ei))?!1:(ni.crossVectors(se,oe),e=[ni.x,ni.y,ni.z],yr(e,Ge,Xe,We,ei))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,zt).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(zt).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Jt[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Jt[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Jt[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Jt[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Jt[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Jt[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Jt[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Jt[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Jt),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Jt=[new T,new T,new T,new T,new T,new T,new T,new T],zt=new T,ti=new Qt,Ge=new T,Xe=new T,We=new T,se=new T,oe=new T,Se=new T,gn=new T,ei=new T,ni=new T,Me=new T;function yr(i,t,e,r,o){for(let l=0,c=i.length-3;l<=c;l+=3){Me.fromArray(i,l);let f=o.x*Math.abs(Me.x)+o.y*Math.abs(Me.y)+o.z*Math.abs(Me.z),h=t.dot(Me),p=e.dot(Me),m=r.dot(Me);if(Math.max(-Math.max(h,p,m),Math.min(h,p,m))>f)return!1}return!0}var ft=new T,ii=new V,Ec=0,Pt=class extends le{constructor(t,e,r=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ec++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=r,this.usage=To,this.updateRanges=[],this.gpuType=Mo,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,r){t*=this.itemSize,r*=e.itemSize;for(let o=0,l=this.itemSize;o<l;o++)this.array[t+o]=e.array[r+o];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,r=this.count;e<r;e++)ii.fromBufferAttribute(this,e),ii.applyMatrix3(t),this.setXY(e,ii.x,ii.y);else if(this.itemSize===3)for(let e=0,r=this.count;e<r;e++)ft.fromBufferAttribute(this,e),ft.applyMatrix3(t),this.setXYZ(e,ft.x,ft.y,ft.z);return this}applyMatrix4(t){for(let e=0,r=this.count;e<r;e++)ft.fromBufferAttribute(this,e),ft.applyMatrix4(t),this.setXYZ(e,ft.x,ft.y,ft.z);return this}applyNormalMatrix(t){for(let e=0,r=this.count;e<r;e++)ft.fromBufferAttribute(this,e),ft.applyNormalMatrix(t),this.setXYZ(e,ft.x,ft.y,ft.z);return this}transformDirection(t){for(let e=0,r=this.count;e<r;e++)ft.fromBufferAttribute(this,e),ft.transformDirection(t),this.setXYZ(e,ft.x,ft.y,ft.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let r=this.array[t*this.itemSize+e];return this.normalized&&(r=pn(r,this.array)),r}setComponent(t,e,r){return this.normalized&&(r=Et(r,this.array)),this.array[t*this.itemSize+e]=r,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=pn(e,this.array)),e}setX(t,e){return this.normalized&&(e=Et(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=pn(e,this.array)),e}setY(t,e){return this.normalized&&(e=Et(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=pn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Et(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=pn(e,this.array)),e}setW(t,e){return this.normalized&&(e=Et(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,r){return t*=this.itemSize,this.normalized&&(e=Et(e,this.array),r=Et(r,this.array)),this.array[t+0]=e,this.array[t+1]=r,this}setXYZ(t,e,r,o){return t*=this.itemSize,this.normalized&&(e=Et(e,this.array),r=Et(r,this.array),o=Et(o,this.array)),this.array[t+0]=e,this.array[t+1]=r,this.array[t+2]=o,this}setXYZW(t,e,r,o,l){return t*=this.itemSize,this.normalized&&(e=Et(e,this.array),r=Et(r,this.array),o=Et(o,this.array),l=Et(l,this.array)),this.array[t+0]=e,this.array[t+1]=r,this.array[t+2]=o,this.array[t+3]=l,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var Ei=class extends Pt{constructor(t,e,r){super(new Uint16Array(t),e,r)}};var Ti=class extends Pt{constructor(t,e,r){super(new Uint32Array(t),e,r)}};var Xt=class extends Pt{constructor(t,e,r){super(new Float32Array(t),e,r)}},Tc=new Qt,xn=new T,vr=new T,Tn=class{constructor(t=new T,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let r=this.center;e!==void 0?r.copy(e):Tc.setFromPoints(t).getCenter(r);let o=0;for(let l=0,c=t.length;l<c;l++)o=Math.max(o,r.distanceToSquared(t[l]));return this.radius=Math.sqrt(o),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let r=this.center.distanceToSquared(t);return e.copy(t),r>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;xn.subVectors(t,this.center);let e=xn.lengthSq();if(e>this.radius*this.radius){let r=Math.sqrt(e),o=(r-this.radius)*.5;this.center.addScaledVector(xn,o/r),this.radius+=o}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(vr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(xn.copy(t.center).add(vr)),this.expandByPoint(xn.copy(t.center).sub(vr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},wc=0,Rt=new lt,Sr=new ce,Ye=new T,Ct=new Qt,_n=new Qt,mt=new T,Wt=class i extends le{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:wc++}),this.uuid=sn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(uc(t)?Ti:Ei)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,r=0){this.groups.push({start:t,count:e,materialIndex:r})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let r=this.attributes.normal;if(r!==void 0){let l=new q().getNormalMatrix(t);r.applyNormalMatrix(l),r.needsUpdate=!0}let o=this.attributes.tangent;return o!==void 0&&(o.transformDirection(t),o.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return Rt.makeRotationFromQuaternion(t),this.applyMatrix4(Rt),this}rotateX(t){return Rt.makeRotationX(t),this.applyMatrix4(Rt),this}rotateY(t){return Rt.makeRotationY(t),this.applyMatrix4(Rt),this}rotateZ(t){return Rt.makeRotationZ(t),this.applyMatrix4(Rt),this}translate(t,e,r){return Rt.makeTranslation(t,e,r),this.applyMatrix4(Rt),this}scale(t,e,r){return Rt.makeScale(t,e,r),this.applyMatrix4(Rt),this}lookAt(t){return Sr.lookAt(t),Sr.updateMatrix(),this.applyMatrix4(Sr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ye).negate(),this.translate(Ye.x,Ye.y,Ye.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let r=[];for(let o=0,l=t.length;o<l;o++){let c=t[o];r.push(c.x,c.y,c.z||0)}this.setAttribute("position",new Xt(r,3))}else{let r=Math.min(t.length,e.count);for(let o=0;o<r;o++){let l=t[o];e.setXYZ(o,l.x,l.y,l.z||0)}t.length>e.count&&ht("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Qt);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){ot("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new T(-1/0,-1/0,-1/0),new T(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let l=e[r];Ct.setFromBufferAttribute(l),this.morphTargetsRelative?(mt.addVectors(this.boundingBox.min,Ct.min),this.boundingBox.expandByPoint(mt),mt.addVectors(this.boundingBox.max,Ct.max),this.boundingBox.expandByPoint(mt)):(this.boundingBox.expandByPoint(Ct.min),this.boundingBox.expandByPoint(Ct.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&ot('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Tn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){ot("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new T,1/0);return}if(t){let r=this.boundingSphere.center;if(Ct.setFromBufferAttribute(t),e)for(let l=0,c=e.length;l<c;l++){let f=e[l];_n.setFromBufferAttribute(f),this.morphTargetsRelative?(mt.addVectors(Ct.min,_n.min),Ct.expandByPoint(mt),mt.addVectors(Ct.max,_n.max),Ct.expandByPoint(mt)):(Ct.expandByPoint(_n.min),Ct.expandByPoint(_n.max))}Ct.getCenter(r);let o=0;for(let l=0,c=t.count;l<c;l++)mt.fromBufferAttribute(t,l),o=Math.max(o,r.distanceToSquared(mt));if(e)for(let l=0,c=e.length;l<c;l++){let f=e[l],h=this.morphTargetsRelative;for(let p=0,m=f.count;p<m;p++)mt.fromBufferAttribute(f,p),h&&(Ye.fromBufferAttribute(t,p),mt.add(Ye)),o=Math.max(o,r.distanceToSquared(mt))}this.boundingSphere.radius=Math.sqrt(o),isNaN(this.boundingSphere.radius)&&ot('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){ot("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let r=e.position,o=e.normal,l=e.uv,c=this.getAttribute("tangent");(c===void 0||c.count!==r.count)&&(c=new Pt(new Float32Array(4*r.count),4),this.setAttribute("tangent",c));let f=[],h=[];for(let O=0;O<r.count;O++)f[O]=new T,h[O]=new T;let p=new T,m=new T,x=new T,_=new V,v=new V,S=new V,E=new T,w=new T;function P(O,X,k){p.fromBufferAttribute(r,O),m.fromBufferAttribute(r,X),x.fromBufferAttribute(r,k),_.fromBufferAttribute(l,O),v.fromBufferAttribute(l,X),S.fromBufferAttribute(l,k),m.sub(p),x.sub(p),v.sub(_),S.sub(_);let H=1/(v.x*S.y-S.x*v.y);isFinite(H)&&(E.copy(m).multiplyScalar(S.y).addScaledVector(x,-v.y).multiplyScalar(H),w.copy(x).multiplyScalar(v.x).addScaledVector(m,-S.x).multiplyScalar(H),f[O].add(E),f[X].add(E),f[k].add(E),h[O].add(w),h[X].add(w),h[k].add(w))}let N=this.groups;N.length===0&&(N=[{start:0,count:t.count}]);for(let O=0,X=N.length;O<X;++O){let k=N[O],H=k.start,Q=k.count;for(let W=H,tt=H+Q;W<tt;W+=3)P(t.getX(W+0),t.getX(W+1),t.getX(W+2))}let C=new T,I=new T,D=new T,B=new T;function z(O){D.fromBufferAttribute(o,O),B.copy(D);let X=f[O];C.copy(X),C.sub(D.multiplyScalar(D.dot(X))).normalize(),I.crossVectors(B,X);let H=I.dot(h[O])<0?-1:1;c.setXYZW(O,C.x,C.y,C.z,H)}for(let O=0,X=N.length;O<X;++O){let k=N[O],H=k.start,Q=k.count;for(let W=H,tt=H+Q;W<tt;W+=3)z(t.getX(W+0)),z(t.getX(W+1)),z(t.getX(W+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let r=this.getAttribute("normal");if(r===void 0||r.count!==e.count)r=new Pt(new Float32Array(e.count*3),3),this.setAttribute("normal",r);else for(let _=0,v=r.count;_<v;_++)r.setXYZ(_,0,0,0);let o=new T,l=new T,c=new T,f=new T,h=new T,p=new T,m=new T,x=new T;if(t)for(let _=0,v=t.count;_<v;_+=3){let S=t.getX(_+0),E=t.getX(_+1),w=t.getX(_+2);o.fromBufferAttribute(e,S),l.fromBufferAttribute(e,E),c.fromBufferAttribute(e,w),m.subVectors(c,l),x.subVectors(o,l),m.cross(x),f.fromBufferAttribute(r,S),h.fromBufferAttribute(r,E),p.fromBufferAttribute(r,w),f.add(m),h.add(m),p.add(m),r.setXYZ(S,f.x,f.y,f.z),r.setXYZ(E,h.x,h.y,h.z),r.setXYZ(w,p.x,p.y,p.z)}else for(let _=0,v=e.count;_<v;_+=3)o.fromBufferAttribute(e,_+0),l.fromBufferAttribute(e,_+1),c.fromBufferAttribute(e,_+2),m.subVectors(c,l),x.subVectors(o,l),m.cross(x),r.setXYZ(_+0,m.x,m.y,m.z),r.setXYZ(_+1,m.x,m.y,m.z),r.setXYZ(_+2,m.x,m.y,m.z);this.normalizeNormals(),r.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,r=t.count;e<r;e++)mt.fromBufferAttribute(t,e),mt.normalize(),t.setXYZ(e,mt.x,mt.y,mt.z)}toNonIndexed(){function t(f,h){let p=f.array,m=f.itemSize,x=f.normalized,_=new p.constructor(h.length*m),v=0,S=0;for(let E=0,w=h.length;E<w;E++){f.isInterleavedBufferAttribute?v=h[E]*f.data.stride+f.offset:v=h[E]*m;for(let P=0;P<m;P++)_[S++]=p[v++]}return new Pt(_,m,x)}if(this.index===null)return ht("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,r=this.index.array,o=this.attributes;for(let f in o){let h=o[f],p=t(h,r);e.setAttribute(f,p)}let l=this.morphAttributes;for(let f in l){let h=[],p=l[f];for(let m=0,x=p.length;m<x;m++){let _=p[m],v=t(_,r);h.push(v)}e.morphAttributes[f]=h}e.morphTargetsRelative=this.morphTargetsRelative;let c=this.groups;for(let f=0,h=c.length;f<h;f++){let p=c[f];e.addGroup(p.start,p.count,p.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let h=this.parameters;for(let p in h)h[p]!==void 0&&(t[p]=h[p]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let r=this.attributes;for(let h in r){let p=r[h];t.data.attributes[h]=p.toJSON(t.data)}let o={},l=!1;for(let h in this.morphAttributes){let p=this.morphAttributes[h],m=[];for(let x=0,_=p.length;x<_;x++){let v=p[x];m.push(v.toJSON(t.data))}m.length>0&&(o[h]=m,l=!0)}l&&(t.data.morphAttributes=o,t.data.morphTargetsRelative=this.morphTargetsRelative);let c=this.groups;c.length>0&&(t.data.groups=JSON.parse(JSON.stringify(c)));let f=this.boundingSphere;return f!==null&&(t.data.boundingSphere=f.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let r=t.index;r!==null&&this.setIndex(r.clone());let o=t.attributes;for(let p in o){let m=o[p];this.setAttribute(p,m.clone(e))}let l=t.morphAttributes;for(let p in l){let m=[],x=l[p];for(let _=0,v=x.length;_<v;_++)m.push(x[_].clone(e));this.morphAttributes[p]=m}this.morphTargetsRelative=t.morphTargetsRelative;let c=t.groups;for(let p=0,m=c.length;p<m;p++){let x=c[p];this.addGroup(x.start,x.count,x.materialIndex)}let f=t.boundingBox;f!==null&&(this.boundingBox=f.clone());let h=t.boundingSphere;return h!==null&&(this.boundingSphere=h.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Mr=new T,Ac=new T,Cc=new q,Ee=class{constructor(t=new T(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,r,o){return this.normal.set(t,e,r),this.constant=o,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,r){let o=Mr.subVectors(r,e).cross(Ac.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(o,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,r=!0){let o=t.delta(Mr),l=this.normal.dot(o);if(l===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let c=-(t.start.dot(this.normal)+this.constant)/l;return r===!0&&(c<0||c>1)?null:e.copy(t.start).addScaledVector(o,c)}intersectsLine(t){let e=this.distanceToPoint(t.start),r=this.distanceToPoint(t.end);return e<0&&r>0||r<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let r=e||Cc.getNormalMatrix(t),o=this.coplanarPoint(Mr).applyMatrix4(t),l=this.normal.applyMatrix3(r).normalize();return this.constant=-o.dot(l),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},Pc=0,wi=class extends le{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Pc++}),this.uuid=sn(),this.name="",this.type="Material",this.blending=uo,this.side=Gi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=fo,this.blendDst=po,this.blendEquation=ho,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ut(0,0,0),this.blendAlpha=0,this.depthFunc=_i,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Eo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=xi,this.stencilZFail=xi,this.stencilZPass=xi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let r=t[e];if(r===void 0){ht(`Material: parameter '${e}' has value of undefined.`);continue}let o=this[e];if(o===void 0){ht(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}o&&o.isColor?o.set(r):o&&o.isVector2&&r&&r.isVector2||o&&o.isEuler&&r&&r.isEuler||o&&o.isVector3&&r&&r.isVector3?o.copy(r):this[e]=r}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let r={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};r.uuid=this.uuid,r.type=this.type,r.blending=this.blending,r.side=this.side,r.shadowSide=this.shadowSide,r.vertexColors=this.vertexColors,r.opacity=this.opacity,r.transparent=this.transparent,r.blendSrc=this.blendSrc,r.blendDst=this.blendDst,r.blendEquation=this.blendEquation,r.blendSrcAlpha=this.blendSrcAlpha,r.blendDstAlpha=this.blendDstAlpha,r.blendEquationAlpha=this.blendEquationAlpha,r.blendColor=this.blendColor.getHex(),r.blendAlpha=this.blendAlpha,r.depthFunc=this.depthFunc,r.depthTest=this.depthTest,r.depthWrite=this.depthWrite,r.colorWrite=this.colorWrite,r.clipIntersection=this.clipIntersection,r.clipShadows=this.clipShadows,r.stencilWriteMask=this.stencilWriteMask,r.stencilFunc=this.stencilFunc,r.stencilRef=this.stencilRef,r.stencilFuncMask=this.stencilFuncMask,r.stencilFail=this.stencilFail,r.stencilZFail=this.stencilZFail,r.stencilZPass=this.stencilZPass,r.stencilWrite=this.stencilWrite,r.polygonOffset=this.polygonOffset,r.polygonOffsetFactor=this.polygonOffsetFactor,r.polygonOffsetUnits=this.polygonOffsetUnits,r.dithering=this.dithering,r.alphaTest=this.alphaTest,r.alphaHash=this.alphaHash,r.alphaToCoverage=this.alphaToCoverage,r.premultipliedAlpha=this.premultipliedAlpha,r.forceSinglePass=this.forceSinglePass,r.allowOverride=this.allowOverride,r.visible=this.visible,r.toneMapped=this.toneMapped,r.name=this.name,this.color&&this.color.isColor&&(r.color=this.color.getHex()),this.roughness!==void 0&&(r.roughness=this.roughness),this.metalness!==void 0&&(r.metalness=this.metalness),this.sheen!==void 0&&(r.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(r.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(r.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(r.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(r.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(r.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(r.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(r.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(r.shininess=this.shininess),this.clearcoat!==void 0&&(r.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(r.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(r.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(r.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(r.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,r.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(r.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(r.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(r.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(r.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(r.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(r.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(r.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(r.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(r.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(r.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(r.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(r.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(r.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(r.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(r.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(r.lightMap=this.lightMap.toJSON(t).uuid,r.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(r.aoMap=this.aoMap.toJSON(t).uuid,r.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(r.bumpMap=this.bumpMap.toJSON(t).uuid,r.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(r.normalMap=this.normalMap.toJSON(t).uuid,r.normalMapType=this.normalMapType,r.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(r.displacementMap=this.displacementMap.toJSON(t).uuid,r.displacementScale=this.displacementScale,r.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(r.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(r.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(r.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(r.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(r.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(r.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(r.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(r.combine=this.combine)),this.envMapRotation!==void 0&&(r.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(r.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(r.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(r.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(r.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(r.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(r.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(r.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(r.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(r.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(r.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(r.size=this.size),this.sizeAttenuation!==void 0&&(r.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(r.clippingPlanes=this.clippingPlanes.map(l=>l.toJSON())),this.rotation!==void 0&&(r.rotation=this.rotation),this.depthPacking!==void 0&&(r.depthPacking=this.depthPacking),this.linewidth!==void 0&&(r.linewidth=this.linewidth),this.linecap!==void 0&&(r.linecap=this.linecap),this.linejoin!==void 0&&(r.linejoin=this.linejoin),this.dashSize!==void 0&&(r.dashSize=this.dashSize),this.gapSize!==void 0&&(r.gapSize=this.gapSize),this.scale!==void 0&&(r.scale=this.scale),this.wireframe!==void 0&&(r.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(r.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(r.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(r.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(r.flatShading=this.flatShading),this.fog!==void 0&&(r.fog=this.fog),Object.keys(this.userData).length>0&&(r.userData=this.userData);function o(l){let c=[];for(let f in l){let h=l[f];delete h.metadata,c.push(h)}return c}if(e){let l=o(t.textures),c=o(t.images);l.length>0&&(r.textures=l),c.length>0&&(r.images=c)}return r}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new ut().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(r=>new Ee().fromJSON(r))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let r=t.normalScale;Array.isArray(r)===!1&&(r=[r,r]),this.normalScale=new V().fromArray(r)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new V().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,r=null;if(e!==null){let o=e.length;r=new Array(o);for(let l=0;l!==o;++l)r[l]=e[l].clone()}return this.clippingPlanes=r,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Kt=new T,br=new T,ri=new T,si=new T,Ai=class{constructor(t=new T,e=new T(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Kt)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let r=e.dot(this.direction);return r<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,r)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Kt.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Kt.copy(this.origin).addScaledVector(this.direction,e),Kt.distanceToSquared(t))}distanceSqToSegment(t,e,r,o){br.copy(t).add(e).multiplyScalar(.5),ri.copy(e).sub(t).normalize(),si.copy(this.origin).sub(br);let l=t.distanceTo(e)*.5,c=-this.direction.dot(ri),f=si.dot(this.direction),h=-si.dot(ri),p=si.lengthSq(),m=Math.abs(1-c*c),x,_,v,S;if(m>0)if(x=c*h-f,_=c*f-h,S=l*m,x>=0)if(_>=-S)if(_<=S){let E=1/m;x*=E,_*=E,v=x*(x+c*_+2*f)+_*(c*x+_+2*h)+p}else _=l,x=Math.max(0,-(c*_+f)),v=-x*x+_*(_+2*h)+p;else _=-l,x=Math.max(0,-(c*_+f)),v=-x*x+_*(_+2*h)+p;else _<=-S?(x=Math.max(0,-(-c*l+f)),_=x>0?-l:Math.min(Math.max(-l,-h),l),v=-x*x+_*(_+2*h)+p):_<=S?(x=0,_=Math.min(Math.max(-l,-h),l),v=_*(_+2*h)+p):(x=Math.max(0,-(c*l+f)),_=x>0?l:Math.min(Math.max(-l,-h),l),v=-x*x+_*(_+2*h)+p);else _=c>0?-l:l,x=Math.max(0,-(c*_+f)),v=-x*x+_*(_+2*h)+p;return r&&r.copy(this.origin).addScaledVector(this.direction,x),o&&o.copy(br).addScaledVector(ri,_),v}intersectSphere(t,e){if(t.radius<0)return null;Kt.subVectors(t.center,this.origin);let r=Kt.dot(this.direction),o=Kt.dot(Kt)-r*r,l=t.radius*t.radius;if(o>l)return null;let c=Math.sqrt(l-o),f=r-c,h=r+c;return h<0?null:f<0?this.at(h,e):this.at(f,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let r=-(this.origin.dot(t.normal)+t.constant)/e;return r>=0?r:null}intersectPlane(t,e){let r=this.distanceToPlane(t);return r===null?null:this.at(r,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let r,o,l,c,f,h,p=1/this.direction.x,m=1/this.direction.y,x=1/this.direction.z,_=this.origin;return p>=0?(r=(t.min.x-_.x)*p,o=(t.max.x-_.x)*p):(r=(t.max.x-_.x)*p,o=(t.min.x-_.x)*p),m>=0?(l=(t.min.y-_.y)*m,c=(t.max.y-_.y)*m):(l=(t.max.y-_.y)*m,c=(t.min.y-_.y)*m),r>c||l>o||((l>r||isNaN(r))&&(r=l),(c<o||isNaN(o))&&(o=c),x>=0?(f=(t.min.z-_.z)*x,h=(t.max.z-_.z)*x):(f=(t.max.z-_.z)*x,h=(t.min.z-_.z)*x),r>h||f>o)||((f>r||r!==r)&&(r=f),(h<o||o!==o)&&(o=h),o<0)?null:this.at(r>=0?r:o,e)}intersectsBox(t){return this.intersectBox(t,Kt)!==null}intersectTriangle(t,e,r,o,l){let c=this.origin,f=this.direction,h=f.x,p=f.y,m=f.z,x=t.x-c.x,_=t.y-c.y,v=t.z-c.z,S=e.x-c.x,E=e.y-c.y,w=e.z-c.z,P=r.x-c.x,N=r.y-c.y,C=r.z-c.z,I=Math.abs(h),D=Math.abs(p),B=Math.abs(m),z,O,X,k,H,Q,W,tt,Y,pt,xt,wt;if(I>=D&&I>=B?(X=h,Q=x,Y=S,wt=P,h>=0?(z=p,O=m,k=_,H=v,W=E,tt=w,pt=N,xt=C):(z=m,O=p,k=v,H=_,W=w,tt=E,pt=C,xt=N)):D>=B?(X=p,Q=_,Y=E,wt=N,p>=0?(z=m,O=h,k=v,H=x,W=w,tt=S,pt=C,xt=P):(z=h,O=m,k=x,H=v,W=S,tt=w,pt=P,xt=C)):(X=m,Q=v,Y=w,wt=C,m>=0?(z=h,O=p,k=x,H=_,W=S,tt=E,pt=P,xt=N):(z=p,O=h,k=_,H=x,W=E,tt=S,pt=N,xt=P)),X===0)return null;let kt=z/X,Vt=O/X,ne=1/X,Wn=k-kt*Q,Yn=H-Vt*Q,Ht=W-kt*Y,qn=tt-Vt*Y,Zn=pt-kt*wt,Jn=xt-Vt*wt,_e=Zn*qn-Jn*Ht,ye=Wn*Jn-Yn*Zn,ve=Ht*Yn-qn*Wn;if(o){if(_e<0||ye<0||ve<0)return null}else if((_e<0||ye<0||ve<0)&&(_e>0||ye>0||ve>0))return null;let Ft=_e+ye+ve;if(Ft===0)return null;let fn=ne*(_e*Q+ye*Y+ve*wt);return(Ft>0?fn<0:fn>0)?null:this.at(fn/Ft,l)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},wn=class extends wi{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ut(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new je,this.combine=$r,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},Js=new lt,be=new Ai,oi=new Tn,Ks=new T,ai=new T,li=new T,ci=new T,Er=new T,ui=new T,$s=new T,hi=new T,Qe=class extends ce{constructor(t=new Wt,e=new wn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,r=Object.keys(e);if(r.length>0){let o=e[r[0]];if(o!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let l=0,c=o.length;l<c;l++){let f=o[l].name||String(l);this.morphTargetInfluences.push(0),this.morphTargetDictionary[f]=l}}}}getVertexPosition(t,e){let r=this.geometry,o=r.attributes.position,l=r.morphAttributes.position,c=r.morphTargetsRelative;e.fromBufferAttribute(o,t);let f=this.morphTargetInfluences;if(l&&f){ui.set(0,0,0);for(let h=0,p=l.length;h<p;h++){let m=f[h],x=l[h];m!==0&&(Er.fromBufferAttribute(x,t),c?ui.addScaledVector(Er,m):ui.addScaledVector(Er.sub(e),m))}e.add(ui)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let r=this.geometry,o=this.material,l=this.matrixWorld;o!==void 0&&(r.boundingSphere===null&&r.computeBoundingSphere(),oi.copy(r.boundingSphere),oi.applyMatrix4(l),be.copy(t.ray).recast(t.near),!(oi.containsPoint(be.origin)===!1&&(be.intersectSphere(oi,Ks)===null||be.origin.distanceToSquared(Ks)>(t.far-t.near)**2))&&(Js.copy(l).invert(),be.copy(t.ray).applyMatrix4(Js),!(r.boundingBox!==null&&be.intersectsBox(r.boundingBox)===!1)&&this._computeIntersections(t,e,be)))}_computeIntersections(t,e,r){let o,l=this.geometry,c=this.material,f=l.index,h=l.attributes.position,p=l.attributes.uv,m=l.attributes.uv1,x=l.attributes.normal,_=l.groups,v=l.drawRange;if(f!==null)if(Array.isArray(c))for(let S=0,E=_.length;S<E;S++){let w=_[S],P=c[w.materialIndex],N=Math.max(w.start,v.start),C=Math.min(f.count,Math.min(w.start+w.count,v.start+v.count));for(let I=N,D=C;I<D;I+=3){let B=f.getX(I),z=f.getX(I+1),O=f.getX(I+2);o=fi(this,P,t,r,p,m,x,B,z,O),o&&(o.faceIndex=Math.floor(I/3),o.face.materialIndex=w.materialIndex,e.push(o))}}else{let S=Math.max(0,v.start),E=Math.min(f.count,v.start+v.count);for(let w=S,P=E;w<P;w+=3){let N=f.getX(w),C=f.getX(w+1),I=f.getX(w+2);o=fi(this,c,t,r,p,m,x,N,C,I),o&&(o.faceIndex=Math.floor(w/3),e.push(o))}}else if(h!==void 0)if(Array.isArray(c))for(let S=0,E=_.length;S<E;S++){let w=_[S],P=c[w.materialIndex],N=Math.max(w.start,v.start),C=Math.min(h.count,Math.min(w.start+w.count,v.start+v.count));for(let I=N,D=C;I<D;I+=3){let B=I,z=I+1,O=I+2;o=fi(this,P,t,r,p,m,x,B,z,O),o&&(o.faceIndex=Math.floor(I/3),o.face.materialIndex=w.materialIndex,e.push(o))}}else{let S=Math.max(0,v.start),E=Math.min(h.count,v.start+v.count);for(let w=S,P=E;w<P;w+=3){let N=w,C=w+1,I=w+2;o=fi(this,c,t,r,p,m,x,N,C,I),o&&(o.faceIndex=Math.floor(w/3),e.push(o))}}}};function Ic(i,t,e,r,o,l,c,f){let h;if(t.side===co?h=r.intersectTriangle(c,l,o,!0,f):h=r.intersectTriangle(o,l,c,t.side===Gi,f),h===null)return null;hi.copy(f),hi.applyMatrix4(i.matrixWorld);let p=e.ray.origin.distanceTo(hi);return p<e.near||p>e.far?null:{distance:p,point:hi.clone(),object:i}}function fi(i,t,e,r,o,l,c,f,h,p){i.getVertexPosition(f,ai),i.getVertexPosition(h,li),i.getVertexPosition(p,ci);let m=Ic(i,t,e,r,ai,li,ci,$s);if(m){let x=new T;ae.getBarycoord($s,ai,li,ci,x),o&&(m.uv=ae.getInterpolatedAttribute(o,f,h,p,x,new V)),l&&(m.uv1=ae.getInterpolatedAttribute(l,f,h,p,x,new V)),c&&(m.normal=ae.getInterpolatedAttribute(c,f,h,p,x,new T),m.normal.dot(r.direction)>0&&m.normal.multiplyScalar(-1));let _={a:f,b:h,c:p,normal:new T,materialIndex:0};ae.getNormal(ai,li,ci,_.normal),m.face=_,m.barycoord=x}return m}var St=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){ht("Curve: .getPoint() not implemented.")}getPointAt(t,e){let r=this.getUtoTmapping(t);return this.getPoint(r,e)}getPoints(t=5){let e=[];for(let r=0;r<=t;r++)e.push(this.getPoint(r/t));return e}getSpacedPoints(t=5){let e=[];for(let r=0;r<=t;r++)e.push(this.getPointAt(r/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],r,o=this.getPoint(0),l=0;e.push(0);for(let c=1;c<=t;c++)r=this.getPoint(c/t),l+=r.distanceTo(o),e.push(l),o=r;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let r=this.getLengths(),o=0,l=r.length,c;e?c=e:c=t*r[l-1];let f=0,h=l-1,p;for(;f<=h;)if(o=Math.floor(f+(h-f)/2),p=r[o]-c,p<0)f=o+1;else if(p>0)h=o-1;else{h=o;break}if(o=h,r[o]===c)return o/(l-1);let m=r[o],_=r[o+1]-m,v=(c-m)/_;return(o+v)/(l-1)}getTangent(t,e){let o=t-1e-4,l=t+1e-4;o<0&&(o=0),l>1&&(l=1);let c=this.getPoint(o),f=this.getPoint(l),h=e||(c.isVector2?new V:new T);return h.copy(f).sub(c).normalize(),h}getTangentAt(t,e){let r=this.getUtoTmapping(t);return this.getTangent(r,e)}computeFrenetFrames(t,e=!1){let r=new T,o=[],l=[],c=[],f=new T,h=new lt;for(let v=0;v<=t;v++){let S=v/t;o[v]=this.getTangentAt(S,new T)}l[0]=new T,c[0]=new T;let p=Number.MAX_VALUE,m=Math.abs(o[0].x),x=Math.abs(o[0].y),_=Math.abs(o[0].z);m<=p&&(p=m,r.set(1,0,0)),x<=p&&(p=x,r.set(0,1,0)),_<=p&&r.set(0,0,1),f.crossVectors(o[0],r).normalize(),l[0].crossVectors(o[0],f),c[0].crossVectors(o[0],l[0]);for(let v=1;v<=t;v++){if(l[v]=l[v-1].clone(),c[v]=c[v-1].clone(),f.crossVectors(o[v-1],o[v]),f.length()>Number.EPSILON){f.normalize();let S=Math.acos($(o[v-1].dot(o[v]),-1,1));l[v].applyMatrix4(h.makeRotationAxis(f,S))}c[v].crossVectors(o[v],l[v])}if(e===!0){let v=Math.acos($(l[0].dot(l[t]),-1,1));v/=t,o[0].dot(f.crossVectors(l[0],l[t]))>0&&(v=-v);for(let S=1;S<=t;S++)l[S].applyMatrix4(h.makeRotationAxis(o[S],v*S)),c[S].crossVectors(o[S],l[S])}return{tangents:o,normals:l,binormals:c}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},tn=class extends St{constructor(t=0,e=0,r=1,o=1,l=0,c=Math.PI*2,f=!1,h=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=r,this.yRadius=o,this.aStartAngle=l,this.aEndAngle=c,this.aClockwise=f,this.aRotation=h}getPoint(t,e=new V){let r=e,o=Math.PI*2,l=this.aEndAngle-this.aStartAngle,c=Math.abs(l)<Number.EPSILON;for(;l<0;)l+=o;for(;l>o;)l-=o;l<Number.EPSILON&&(c?l=0:l=o),this.aClockwise===!0&&!c&&(l===o?l=-o:l=l-o);let f=this.aStartAngle+t*l,h=this.aX+this.xRadius*Math.cos(f),p=this.aY+this.yRadius*Math.sin(f);if(this.aRotation!==0){let m=Math.cos(this.aRotation),x=Math.sin(this.aRotation),_=h-this.aX,v=p-this.aY;h=_*m-v*x+this.aX,p=_*x+v*m+this.aY}return r.set(h,p)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Ci=class extends tn{constructor(t,e,r,o,l,c){super(t,e,r,r,o,l,c),this.isArcCurve=!0,this.type="ArcCurve"}};function ls(){let i=0,t=0,e=0,r=0;function o(l,c,f,h){i=l,t=f,e=-3*l+3*c-2*f-h,r=2*l-2*c+f+h}return{initCatmullRom:function(l,c,f,h,p){o(c,f,p*(f-l),p*(h-c))},initNonuniformCatmullRom:function(l,c,f,h,p,m,x){let _=(c-l)/p-(f-l)/(p+m)+(f-c)/m,v=(f-c)/m-(h-c)/(m+x)+(h-f)/x;_*=m,v*=m,o(c,f,_,v)},calc:function(l){let c=l*l,f=c*l;return i+t*l+e*c+r*f}}}var js=new T,Qs=new T,Tr=new ls,wr=new ls,Ar=new ls,en=class extends St{constructor(t=[],e=!1,r="centripetal",o=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=r,this.tension=o}getPoint(t,e=new T){let r=e,o=this.points,l=o.length,c=(l-(this.closed?0:1))*t,f=Math.floor(c),h=c-f;this.closed?f+=f>0?0:(Math.floor(Math.abs(f)/l)+1)*l:h===0&&f===l-1&&(f=l-2,h=1);let p,m;this.closed||f>0?p=o[(f-1)%l]:(Qs.subVectors(o[0],o[1]).add(o[0]),p=Qs);let x=o[f%l],_=o[(f+1)%l];if(this.closed||f+2<l?m=o[(f+2)%l]:(js.subVectors(o[l-1],o[l-2]).add(o[l-1]),m=js),this.curveType==="centripetal"||this.curveType==="chordal"){let v=this.curveType==="chordal"?.5:.25,S=Math.pow(p.distanceToSquared(x),v),E=Math.pow(x.distanceToSquared(_),v),w=Math.pow(_.distanceToSquared(m),v);E<1e-4&&(E=1),S<1e-4&&(S=E),w<1e-4&&(w=E),Tr.initNonuniformCatmullRom(p.x,x.x,_.x,m.x,S,E,w),wr.initNonuniformCatmullRom(p.y,x.y,_.y,m.y,S,E,w),Ar.initNonuniformCatmullRom(p.z,x.z,_.z,m.z,S,E,w)}else this.curveType==="catmullrom"&&(Tr.initCatmullRom(p.x,x.x,_.x,m.x,this.tension),wr.initCatmullRom(p.y,x.y,_.y,m.y,this.tension),Ar.initCatmullRom(p.z,x.z,_.z,m.z,this.tension));return r.set(Tr.calc(h),wr.calc(h),Ar.calc(h)),r}copy(t){super.copy(t),this.points=[];for(let e=0,r=t.points.length;e<r;e++){let o=t.points[e];this.points.push(o.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,r=this.points.length;e<r;e++){let o=this.points[e];t.points.push(o.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,r=t.points.length;e<r;e++){let o=t.points[e];this.points.push(new T().fromArray(o))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function to(i,t,e,r,o){let l=(r-t)*.5,c=(o-e)*.5,f=i*i,h=i*f;return(2*e-2*r+l+c)*h+(-3*e+3*r-2*l-c)*f+l*i+e}function Rc(i,t){let e=1-i;return e*e*t}function Lc(i,t){return 2*(1-i)*i*t}function Nc(i,t){return i*i*t}function Mn(i,t,e,r){return Rc(i,t)+Lc(i,e)+Nc(i,r)}function Dc(i,t){let e=1-i;return e*e*e*t}function Oc(i,t){let e=1-i;return 3*e*e*i*t}function Fc(i,t){return 3*(1-i)*i*i*t}function Bc(i,t){return i*i*i*t}function bn(i,t,e,r,o){return Dc(i,t)+Oc(i,e)+Fc(i,r)+Bc(i,o)}var An=class extends St{constructor(t=new V,e=new V,r=new V,o=new V){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=r,this.v3=o}getPoint(t,e=new V){let r=e,o=this.v0,l=this.v1,c=this.v2,f=this.v3;return r.set(bn(t,o.x,l.x,c.x,f.x),bn(t,o.y,l.y,c.y,f.y)),r}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Pi=class extends St{constructor(t=new T,e=new T,r=new T,o=new T){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=r,this.v3=o}getPoint(t,e=new T){let r=e,o=this.v0,l=this.v1,c=this.v2,f=this.v3;return r.set(bn(t,o.x,l.x,c.x,f.x),bn(t,o.y,l.y,c.y,f.y),bn(t,o.z,l.z,c.z,f.z)),r}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Cn=class extends St{constructor(t=new V,e=new V){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new V){let r=e;return t===1?r.copy(this.v2):(r.copy(this.v2).sub(this.v1),r.multiplyScalar(t).add(this.v1)),r}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new V){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ii=class extends St{constructor(t=new T,e=new T){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new T){let r=e;return t===1?r.copy(this.v2):(r.copy(this.v2).sub(this.v1),r.multiplyScalar(t).add(this.v1)),r}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new T){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Pn=class extends St{constructor(t=new V,e=new V,r=new V){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=r}getPoint(t,e=new V){let r=e,o=this.v0,l=this.v1,c=this.v2;return r.set(Mn(t,o.x,l.x,c.x),Mn(t,o.y,l.y,c.y)),r}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ri=class extends St{constructor(t=new T,e=new T,r=new T){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=r}getPoint(t,e=new T){let r=e,o=this.v0,l=this.v1,c=this.v2;return r.set(Mn(t,o.x,l.x,c.x),Mn(t,o.y,l.y,c.y),Mn(t,o.z,l.z,c.z)),r}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},In=class extends St{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new V){let r=e,o=this.points,l=(o.length-1)*t,c=Math.floor(l),f=l-c,h=o[c===0?c:c-1],p=o[c],m=o[c>o.length-2?o.length-1:c+1],x=o[c>o.length-3?o.length-1:c+2];return r.set(to(f,h.x,p.x,m.x,x.x),to(f,h.y,p.y,m.y,x.y)),r}copy(t){super.copy(t),this.points=[];for(let e=0,r=t.points.length;e<r;e++){let o=t.points[e];this.points.push(o.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,r=this.points.length;e<r;e++){let o=this.points[e];t.points.push(o.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,r=t.points.length;e<r;e++){let o=t.points[e];this.points.push(new V().fromArray(o))}return this}},eo=Object.freeze({__proto__:null,ArcCurve:Ci,CatmullRomCurve3:en,CubicBezierCurve:An,CubicBezierCurve3:Pi,EllipseCurve:tn,LineCurve:Cn,LineCurve3:Ii,QuadraticBezierCurve:Pn,QuadraticBezierCurve3:Ri,SplineCurve:In}),Li=class extends St{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let r=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new eo[r](e,t))}return this}getPoint(t,e){let r=t*this.getLength(),o=this.getCurveLengths(),l=0;for(;l<o.length;){if(o[l]>=r){let c=o[l]-r,f=this.curves[l],h=f.getLength(),p=h===0?0:1-c/h;return f.getPointAt(p,e)}l++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let r=0,o=this.curves.length;r<o;r++)e+=this.curves[r].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let r=0;r<=t;r++)e.push(this.getPoint(r/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],r;for(let o=0,l=this.curves;o<l.length;o++){let c=l[o],f=c.isEllipseCurve?t*2:c.isLineCurve||c.isLineCurve3?1:c.isSplineCurve?t*c.points.length:t,h=c.getPoints(f);for(let p=0;p<h.length;p++){let m=h[p];r&&r.equals(m)||(e.push(m),r=m)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,r=t.curves.length;e<r;e++){let o=t.curves[e];this.curves.push(o.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,r=this.curves.length;e<r;e++){let o=this.curves[e];t.curves.push(o.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,r=t.curves.length;e<r;e++){let o=t.curves[e];this.curves.push(new eo[o.type]().fromJSON(o))}return this}},Te=class extends Li{constructor(t){super(),this.type="Path",this.currentPoint=new V,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,r=t.length;e<r;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let r=new Cn(this.currentPoint.clone(),new V(t,e));return this.curves.push(r),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,r,o){let l=new Pn(this.currentPoint.clone(),new V(t,e),new V(r,o));return this.curves.push(l),this.currentPoint.set(r,o),this}bezierCurveTo(t,e,r,o,l,c){let f=new An(this.currentPoint.clone(),new V(t,e),new V(r,o),new V(l,c));return this.curves.push(f),this.currentPoint.set(l,c),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),r=new In(e);return this.curves.push(r),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,r,o,l,c){let f=this.currentPoint.x,h=this.currentPoint.y;return this.absarc(t+f,e+h,r,o,l,c),this}absarc(t,e,r,o,l,c){return this.absellipse(t,e,r,r,o,l,c),this}ellipse(t,e,r,o,l,c,f,h){let p=this.currentPoint.x,m=this.currentPoint.y;return this.absellipse(t+p,e+m,r,o,l,c,f,h),this}absellipse(t,e,r,o,l,c,f,h){let p=new tn(t,e,r,o,l,c,f,h);if(this.curves.length>0){let x=p.getPoint(0);x.equals(this.currentPoint)||this.lineTo(x.x,x.y)}this.curves.push(p);let m=p.getPoint(1);return this.currentPoint.copy(m),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},nn=class extends Te{constructor(t){super(t),this.uuid=sn(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let r=0,o=this.holes.length;r<o;r++)e[r]=this.holes[r].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,r=t.holes.length;e<r;e++){let o=t.holes[e];this.holes.push(o.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,r=this.holes.length;e<r;e++){let o=this.holes[e];t.holes.push(o.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,r=t.holes.length;e<r;e++){let o=t.holes[e];this.holes.push(new Te().fromJSON(o))}return this}};function Uc(i,t,e=2){let r=t&&t.length,o=r?t[0]*e:i.length,l=Co(i,0,o,e,!0),c=[];if(!l||l.next===l.prev)return c;let f,h,p;if(r&&(l=Gc(i,t,l,e)),i.length>80*e){f=i[0],h=i[1];let m=f,x=h;for(let _=e;_<o;_+=e){let v=i[_],S=i[_+1];v<f&&(f=v),S<h&&(h=S),v>m&&(m=v),S>x&&(x=S)}p=Math.max(m-f,x-h),p=p!==0?32767/p:0}return Rn(l,c,e,f,h,p,0),c}function Co(i,t,e,r,o){let l;if(o===tu(i,t,e,r)>0)for(let c=t;c<e;c+=r)l=no(c/r|0,i[c],i[c+1],l);else for(let c=e-r;c>=t;c-=r)l=no(c/r|0,i[c],i[c+1],l);return l&&rn(l,l.next)&&(Nn(l),l=l.next),l}function we(i,t){if(!i)return i;t||(t=i);let e=i,r;do if(r=!1,!e.steiner&&(rn(e,e.next)||at(e.prev,e,e.next)===0)){if(Nn(e),e=t=e.prev,e===e.next)break;r=!0}else e=e.next;while(r||e!==t);return t}function Rn(i,t,e,r,o,l,c){if(!i)return;!c&&l&&Zc(i,r,o,l);let f=i;for(;i.prev!==i.next;){let h=i.prev,p=i.next;if(l?kc(i,r,o,l):zc(i)){t.push(h.i,i.i,p.i),Nn(i),i=p.next,f=p.next;continue}if(i=p,i===f){c?c===1?(i=Vc(we(i),t),Rn(i,t,e,r,o,l,2)):c===2&&Hc(i,t,e,r,o,l):Rn(we(i),t,e,r,o,l,1);break}}}function zc(i){let t=i.prev,e=i,r=i.next;if(at(t,e,r)>=0)return!1;let o=t.x,l=e.x,c=r.x,f=t.y,h=e.y,p=r.y,m=Math.min(o,l,c),x=Math.min(f,h,p),_=Math.max(o,l,c),v=Math.max(f,h,p),S=r.next;for(;S!==t;){if(S.x>=m&&S.x<=_&&S.y>=x&&S.y<=v&&Sn(o,f,l,h,c,p,S.x,S.y)&&at(S.prev,S,S.next)>=0)return!1;S=S.next}return!0}function kc(i,t,e,r){let o=i.prev,l=i,c=i.next;if(at(o,l,c)>=0)return!1;let f=o.x,h=l.x,p=c.x,m=o.y,x=l.y,_=c.y,v=Math.min(f,h,p),S=Math.min(m,x,_),E=Math.max(f,h,p),w=Math.max(m,x,_),P=Yr(v,S,t,e,r),N=Yr(E,w,t,e,r),C=i.prevZ,I=i.nextZ;for(;C&&C.z>=P&&I&&I.z<=N;){if(C.x>=v&&C.x<=E&&C.y>=S&&C.y<=w&&C!==o&&C!==c&&Sn(f,m,h,x,p,_,C.x,C.y)&&at(C.prev,C,C.next)>=0||(C=C.prevZ,I.x>=v&&I.x<=E&&I.y>=S&&I.y<=w&&I!==o&&I!==c&&Sn(f,m,h,x,p,_,I.x,I.y)&&at(I.prev,I,I.next)>=0))return!1;I=I.nextZ}for(;C&&C.z>=P;){if(C.x>=v&&C.x<=E&&C.y>=S&&C.y<=w&&C!==o&&C!==c&&Sn(f,m,h,x,p,_,C.x,C.y)&&at(C.prev,C,C.next)>=0)return!1;C=C.prevZ}for(;I&&I.z<=N;){if(I.x>=v&&I.x<=E&&I.y>=S&&I.y<=w&&I!==o&&I!==c&&Sn(f,m,h,x,p,_,I.x,I.y)&&at(I.prev,I,I.next)>=0)return!1;I=I.nextZ}return!0}function Vc(i,t){let e=i;do{let r=e.prev,o=e.next.next;!rn(r,o)&&Io(r,e,e.next,o)&&Ln(r,o)&&Ln(o,r)&&(t.push(r.i,e.i,o.i),Nn(e),Nn(e.next),e=i=o),e=e.next}while(e!==i);return we(e)}function Hc(i,t,e,r,o,l){let c=i;do{let f=c.next.next;for(;f!==c.prev;){if(c.i!==f.i&&$c(c,f)){let h=Ro(c,f);c=we(c,c.next),h=we(h,h.next),Rn(c,t,e,r,o,l,0),Rn(h,t,e,r,o,l,0);return}f=f.next}c=c.next}while(c!==i)}function Gc(i,t,e,r){let o=[];for(let l=0,c=t.length;l<c;l++){let f=t[l]*r,h=l<c-1?t[l+1]*r:i.length,p=Co(i,f,h,r,!1);p===p.next&&(p.steiner=!0),o.push(Kc(p))}o.sort(Xc);for(let l=0;l<o.length;l++)e=Wc(o[l],e);return e}function Xc(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let r=(i.next.y-i.y)/(i.next.x-i.x),o=(t.next.y-t.y)/(t.next.x-t.x);e=r-o}return e}function Wc(i,t){let e=Yc(i,t);if(!e)return t;let r=Ro(e,i);return we(r,r.next),we(e,e.next)}function Yc(i,t){let e=t,r=i.x,o=i.y,l=-1/0,c;if(rn(i,e))return e;do{if(rn(i,e.next))return e.next;if(o<=e.y&&o>=e.next.y&&e.next.y!==e.y){let x=e.x+(o-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(x<=r&&x>l&&(l=x,c=e.x<e.next.x?e:e.next,x===r))return c}e=e.next}while(e!==t);if(!c)return null;let f=c,h=c.x,p=c.y,m=1/0;e=c;do{if(r>=e.x&&e.x>=h&&r!==e.x&&Po(o<p?r:l,o,h,p,o<p?l:r,o,e.x,e.y)){let x=Math.abs(o-e.y)/(r-e.x);Ln(e,i)&&(x<m||x===m&&(e.x>c.x||e.x===c.x&&qc(c,e)))&&(c=e,m=x)}e=e.next}while(e!==f);return c}function qc(i,t){return at(i.prev,i,t.prev)<0&&at(t.next,i,i.next)<0}function Zc(i,t,e,r){let o=i;do o.z===0&&(o.z=Yr(o.x,o.y,t,e,r)),o.prevZ=o.prev,o.nextZ=o.next,o=o.next;while(o!==i);o.prevZ.nextZ=null,o.prevZ=null,Jc(o)}function Jc(i){let t,e=1;do{let r=i,o;i=null;let l=null;for(t=0;r;){t++;let c=r,f=0;for(let p=0;p<e&&(f++,c=c.nextZ,!!c);p++);let h=e;for(;f>0||h>0&&c;)f!==0&&(h===0||!c||r.z<=c.z)?(o=r,r=r.nextZ,f--):(o=c,c=c.nextZ,h--),l?l.nextZ=o:i=o,o.prevZ=l,l=o;r=c}l.nextZ=null,e*=2}while(t>1);return i}function Yr(i,t,e,r,o){return i=(i-e)*o|0,t=(t-r)*o|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function Kc(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Po(i,t,e,r,o,l,c,f){return(o-c)*(t-f)>=(i-c)*(l-f)&&(i-c)*(r-f)>=(e-c)*(t-f)&&(e-c)*(l-f)>=(o-c)*(r-f)}function Sn(i,t,e,r,o,l,c,f){return!(i===c&&t===f)&&Po(i,t,e,r,o,l,c,f)}function $c(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!jc(i,t)&&(Ln(i,t)&&Ln(t,i)&&Qc(i,t)&&(at(i.prev,i,t.prev)||at(i,t.prev,t))||rn(i,t)&&at(i.prev,i,i.next)>0&&at(t.prev,t,t.next)>0)}function at(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function rn(i,t){return i.x===t.x&&i.y===t.y}function Io(i,t,e,r){let o=pi(at(i,t,e)),l=pi(at(i,t,r)),c=pi(at(e,r,i)),f=pi(at(e,r,t));return!!(o!==l&&c!==f||o===0&&di(i,e,t)||l===0&&di(i,r,t)||c===0&&di(e,i,r)||f===0&&di(e,t,r))}function di(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function pi(i){return i>0?1:i<0?-1:0}function jc(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Io(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Ln(i,t){return at(i.prev,i,i.next)<0?at(i,t,i.next)>=0&&at(i,i.prev,t)>=0:at(i,t,i.prev)<0||at(i,i.next,t)<0}function Qc(i,t){let e=i,r=!1,o=(i.x+t.x)/2,l=(i.y+t.y)/2;do e.y>l!=e.next.y>l&&e.next.y!==e.y&&o<(e.next.x-e.x)*(l-e.y)/(e.next.y-e.y)+e.x&&(r=!r),e=e.next;while(e!==i);return r}function Ro(i,t){let e=qr(i.i,i.x,i.y),r=qr(t.i,t.x,t.y),o=i.next,l=t.prev;return i.next=t,t.prev=i,e.next=o,o.prev=e,r.next=e,e.prev=r,l.next=r,r.prev=l,r}function no(i,t,e,r){let o=qr(i,t,e);return r?(o.next=r.next,o.prev=r,r.next.prev=o,r.next=o):(o.prev=o,o.next=o),o}function Nn(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function qr(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function tu(i,t,e,r){let o=0;for(let l=t,c=e-r;l<e;l+=r)o+=(i[c]-i[l])*(i[l+1]+i[c+1]),c=l;return o}var Zr=class{static triangulate(t,e,r=2){return Uc(t,e,r)}},Dt=class i{static area(t){let e=t.length,r=0;for(let o=e-1,l=0;l<e;o=l++)r+=t[o].x*t[l].y-t[l].x*t[o].y;return r*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let r=[],o=[],l=[];io(t),ro(r,t);let c=t.length;e.forEach(io);for(let h=0;h<e.length;h++)o.push(c),c+=e[h].length,ro(r,e[h]);let f=Zr.triangulate(r,o);for(let h=0;h<f.length;h+=3)l.push(f.slice(h,h+3));return l}};function io(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function ro(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Dn=class i extends Wt{constructor(t=new nn([new V(0,.5),new V(-.5,-.5),new V(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};let r=[],o=[],l=[],c=[],f=0,h=0;if(Array.isArray(t)===!1)p(t);else for(let m=0;m<t.length;m++)p(t[m]),this.addGroup(f,h,m),f+=h,h=0;this.setIndex(r),this.setAttribute("position",new Xt(o,3)),this.setAttribute("normal",new Xt(l,3)),this.setAttribute("uv",new Xt(c,2));function p(m){let x=o.length/3,_=m.extractPoints(e),v=_.shape,S=_.holes;Dt.isClockWise(v)===!1&&(v=v.reverse());for(let w=0,P=S.length;w<P;w++){let N=S[w];Dt.isClockWise(N)===!0&&(S[w]=N.reverse())}let E=Dt.triangulateShape(v,S);for(let w=0,P=S.length;w<P;w++){let N=S[w];v=v.concat(N)}for(let w=0,P=v.length;w<P;w++){let N=v[w];o.push(N.x,N.y,0),l.push(0,0,1),c.push(N.x,N.y)}for(let w=0,P=E.length;w<P;w++){let N=E[w],C=N[0]+x,I=N[1]+x,D=N[2]+x;r.push(C,I,D),h+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes;return eu(e,t)}static fromJSON(t,e){let r=[];for(let o=0,l=t.shapes.length;o<l;o++){let c=e[t.shapes[o]];r.push(c)}return new i(r,t.curveSegments)}};function eu(i,t){if(t.shapes=[],Array.isArray(i))for(let e=0,r=i.length;e<r;e++){let o=i[e];t.shapes.push(o.uuid)}else t.shapes.push(i.uuid);return t}function Lo(i){let t={};for(let e in i){t[e]={};for(let r in i[e]){let o=i[e][r];if(so(o))o.isRenderTargetTexture?(ht("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][r]=null):t[e][r]=o.clone();else if(Array.isArray(o))if(so(o[0])){let l=[];for(let c=0,f=o.length;c<f;c++)l[c]=o[c].clone();t[e][r]=l}else t[e][r]=o.slice();else t[e][r]=o}}return t}function Mt(i){let t={};for(let e=0;e<i.length;e++){let r=Lo(i[e]);for(let o in r)t[o]=r[o]}return t}function so(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function qe(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function Cr(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var ue=class{constructor(t,e,r,o){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=o!==void 0?o:new e.constructor(r),this.sampleValues=e,this.valueSize=r,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,r=this._cachedIndex,o=e[r],l=e[r-1];n:{t:{let c;e:{i:if(!(t<o)){for(let f=r+2;;){if(o===void 0){if(t<l)break i;return r=e.length,this._cachedIndex=r,this.copySampleValue_(r-1)}if(r===f)break;if(l=o,o=e[++r],t<o)break t}c=e.length;break e}if(!(t>=l)){let f=e[1];t<f&&(r=2,l=f);for(let h=r-2;;){if(l===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===h)break;if(o=l,l=e[--r-1],t>=l)break t}c=r,r=0;break e}break n}for(;r<c;){let f=r+c>>>1;t<e[f]?c=f:r=f+1}if(o=e[r],l=e[r-1],l===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(o===void 0)return r=e.length,this._cachedIndex=r,this.copySampleValue_(r-1)}this._cachedIndex=r,this.intervalChanged_(r,l,o)}return this.interpolate_(r,l,t,o)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=t*o;for(let c=0;c!==o;++c)e[c]=r[l+c];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Ni=class extends ue{constructor(t,e,r,o){super(t,e,r,o),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:zr,endingEnd:zr}}intervalChanged_(t,e,r){let o=this.parameterPositions,l=t-2,c=t+1,f=o[l],h=o[c];if(f===void 0)switch(this.getSettings_().endingStart){case kr:l=t,f=2*e-r;break;case Vr:l=o.length-2,f=e+o[l]-o[l+1];break;default:l=t,f=r}if(h===void 0)switch(this.getSettings_().endingEnd){case kr:c=t,h=2*r-e;break;case Vr:c=1,h=r+o[1]-o[0];break;default:c=t-1,h=e}let p=(r-e)*.5,m=this.valueSize;this._weightPrev=p/(e-f),this._weightNext=p/(h-r),this._offsetPrev=l*m,this._offsetNext=c*m}interpolate_(t,e,r,o){let l=this.resultBuffer,c=this.sampleValues,f=this.valueSize,h=t*f,p=h-f,m=this._offsetPrev,x=this._offsetNext,_=this._weightPrev,v=this._weightNext,S=(r-e)/(o-e),E=S*S,w=E*S,P=-_*w+2*_*E-_*S,N=(1+_)*w+(-1.5-2*_)*E+(-.5+_)*S+1,C=(-1-v)*w+(1.5+v)*E+.5*S,I=v*w-v*E;for(let D=0;D!==f;++D)l[D]=P*c[m+D]+N*c[p+D]+C*c[h+D]+I*c[x+D];return l}},Di=class extends ue{constructor(t,e,r,o){super(t,e,r,o)}interpolate_(t,e,r,o){let l=this.resultBuffer,c=this.sampleValues,f=this.valueSize,h=t*f,p=h-f,m=(r-e)/(o-e),x=1-m;for(let _=0;_!==f;++_)l[_]=c[p+_]*x+c[h+_]*m;return l}},Oi=class extends ue{constructor(t,e,r,o){super(t,e,r,o)}interpolate_(t){return this.copySampleValue_(t-1)}},Fi=class extends ue{interpolate_(t,e,r,o){let l=this.resultBuffer,c=this.sampleValues,f=this.valueSize,h=t*f,p=h-f,m=this.inTangents,x=this.outTangents;if(!m||!x){let S=(r-e)/(o-e),E=1-S;for(let w=0;w!==f;++w)l[w]=c[p+w]*E+c[h+w]*S;return l}let _=f*2,v=t-1;for(let S=0;S!==f;++S){let E=c[p+S],w=c[h+S],P=v*_+S*2,N=x[P],C=x[P+1],I=t*_+S*2,D=m[I],B=m[I+1],z=iu(r,e,N,D,o);l[S]=No(z,E,C,B,w)}return l}};function No(i,t,e,r,o){let l=1-i;return l*l*l*t+3*l*l*i*e+3*l*i*i*r+i*i*i*o}function nu(i,t,e,r,o){let l=1-i;return 3*l*l*(e-t)+6*l*i*(r-e)+3*i*i*(o-r)}function iu(i,t,e,r,o){let l=(i-t)/(o-t);for(let c=0;c<8;c++){let f=No(l,t,e,r,o)-i;if(Math.abs(f)<1e-10)break;let h=nu(l,t,e,r,o);if(Math.abs(h)<1e-10)break;l=Math.max(0,Math.min(1,l-f/h))}return l}var It=class{constructor(t,e,r,o){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=qe(e,this.TimeBufferType),this.values=qe(r,this.ValueBufferType),this.setInterpolation(o||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,r;if(e.toJSON!==this.toJSON)r=e.toJSON(t);else{r={name:t.name,times:qe(t.times,Array),values:qe(t.values,Array)};let o=t.getInterpolation();o!==t.DefaultInterpolation&&(r.interpolation=o),Cr(t.settings)&&(r.settings={inTangents:qe(t.settings.inTangents,Array),outTangents:qe(t.settings.outTangents,Array)})}return r.type=t.ValueTypeName,r}InterpolantFactoryMethodDiscrete(t){return new Oi(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new Di(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Ni(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new Fi(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case En:e=this.InterpolantFactoryMethodDiscrete;break;case yi:e=this.InterpolantFactoryMethodLinear;break;case mi:e=this.InterpolantFactoryMethodSmooth;break;case Ur:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let r="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(r);return ht("KeyframeTrack:",r),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return En;case this.InterpolantFactoryMethodLinear:return yi;case this.InterpolantFactoryMethodSmooth:return mi;case this.InterpolantFactoryMethodBezier:return Ur}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let r=0,o=e.length;r!==o;++r)e[r]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let r=0,o=e.length;r!==o;++r)e[r]*=t;Cr(this.settings)&&(oo(this.settings.inTangents,t),oo(this.settings.outTangents,t))}return this}trim(t,e){let r=this.times,o=r.length,l=0,c=o-1;for(;l!==o&&r[l]<t;)++l;for(;c!==-1&&r[c]>e;)--c;if(++c,l!==0||c!==o){l>=c&&(c=Math.max(c,1),l=c-1);let f=this.getValueSize();this.times=r.slice(l,c),this.values=this.values.slice(l*f,c*f)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(ot("KeyframeTrack: Invalid value size in track.",this),t=!1);let r=this.times,o=this.values,l=r.length;l===0&&(ot("KeyframeTrack: Track is empty.",this),t=!1);let c=null;for(let f=0;f!==l;f++){let h=r[f];if(typeof h=="number"&&isNaN(h)){ot("KeyframeTrack: Time is not a valid number.",this,f,h),t=!1;break}if(c!==null&&c>h){ot("KeyframeTrack: Out of order keys.",this,f,h,c),t=!1;break}c=h}if(o!==void 0&&hc(o))for(let f=0,h=o.length;f!==h;++f){let p=o[f];if(isNaN(p)){ot("KeyframeTrack: Value is not a valid number.",this,f,p),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),r=this.getValueSize(),o=this.getInterpolation()===mi,l=t.length-1,c=1;for(let f=1;f<l;++f){let h=!1,p=t[f],m=t[f+1];if(p!==m&&(f!==1||p!==t[0]))if(o)h=!0;else{let x=f*r,_=x-r,v=x+r;for(let S=0;S!==r;++S){let E=e[x+S];if(E!==e[_+S]||E!==e[v+S]){h=!0;break}}}if(h){if(f!==c){t[c]=t[f];let x=f*r,_=c*r;for(let v=0;v!==r;++v)e[_+v]=e[x+v]}++c}}if(l>0){t[c]=t[l];for(let f=l*r,h=c*r,p=0;p!==r;++p)e[h+p]=e[f+p];++c}return c!==t.length?(this.times=t.slice(0,c),this.values=e.slice(0,c*r)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),r=this.constructor,o=new r(this.name,t,e);return o.createInterpolant=this.createInterpolant,Cr(this.settings)&&(o.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),o}};function oo(i,t){for(let e=0,r=i.length;e!==r;e+=2)i[e]*=t}It.prototype.ValueTypeName="";It.prototype.TimeBufferType=Float32Array;It.prototype.ValueBufferType=Float32Array;It.prototype.DefaultInterpolation=yi;var he=class extends It{constructor(t,e,r){super(t,e,r)}};he.prototype.ValueTypeName="bool";he.prototype.ValueBufferType=Array;he.prototype.DefaultInterpolation=En;he.prototype.InterpolantFactoryMethodLinear=void 0;he.prototype.InterpolantFactoryMethodSmooth=void 0;var Bi=class extends It{constructor(t,e,r,o){super(t,e,r,o)}};Bi.prototype.ValueTypeName="color";var Ui=class extends It{constructor(t,e,r,o){super(t,e,r,o)}};Ui.prototype.ValueTypeName="number";var zi=class extends ue{constructor(t,e,r,o){super(t,e,r,o)}interpolate_(t,e,r,o){let l=this.resultBuffer,c=this.sampleValues,f=this.valueSize,h=(r-e)/(o-e),p=t*f;for(let m=p+f;p!==m;p+=4)jt.slerpFlat(l,0,c,p-f,c,p,h);return l}},On=class extends It{constructor(t,e,r,o){super(t,e,r,o)}InterpolantFactoryMethodLinear(t){return new zi(this.times,this.values,this.getValueSize(),t)}};On.prototype.ValueTypeName="quaternion";On.prototype.InterpolantFactoryMethodSmooth=void 0;var fe=class extends It{constructor(t,e,r){super(t,e,r)}};fe.prototype.ValueTypeName="string";fe.prototype.ValueBufferType=Array;fe.prototype.DefaultInterpolation=En;fe.prototype.InterpolantFactoryMethodLinear=void 0;fe.prototype.InterpolantFactoryMethodSmooth=void 0;var ki=class extends It{constructor(t,e,r,o){super(t,e,r,o)}};ki.prototype.ValueTypeName="vector";var Vi=class{constructor(t,e,r){let o=this,l=!1,c=0,f=0,h,p=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=r,this._abortController=null,this.itemStart=function(m){f++,l===!1&&o.onStart!==void 0&&o.onStart(m,c,f),l=!0},this.itemEnd=function(m){c++,o.onProgress!==void 0&&o.onProgress(m,c,f),c===f&&(l=!1,o.onLoad!==void 0&&o.onLoad())},this.itemError=function(m){o.onError!==void 0&&o.onError(m)},this.resolveURL=function(m){return m=m.normalize("NFC"),h?h(m):m},this.setURLModifier=function(m){return h=m,this},this.addHandler=function(m,x){return p.push(m,x),this},this.removeHandler=function(m){let x=p.indexOf(m);return x!==-1&&p.splice(x,2),this},this.getHandler=function(m){for(let x=0,_=p.length;x<_;x+=2){let v=p[x],S=p[x+1];if(v.global&&(v.lastIndex=0),v.test(m))return S}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Do=new Vi,Hi=class{constructor(t){this.manager=t!==void 0?t:Do,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let r=this;return new Promise(function(o,l){r.load(t,o,e,l)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};Hi.DEFAULT_MATERIAL_NAME="__DEFAULT";var cs="\\[\\]\\.:\\/",ru=new RegExp("["+cs+"]","g"),us="[^"+cs+"]",su="[^"+cs.replace("\\.","")+"]",ou=/((?:WC+[\/:])*)/.source.replace("WC",us),au=/(WCOD+)?/.source.replace("WCOD",su),lu=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",us),cu=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",us),uu=new RegExp("^"+ou+au+lu+cu+"$"),hu=["material","materials","bones","map"],Jr=class{constructor(t,e,r){let o=r||rt.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,o)}getValue(t,e){this.bind();let r=this._targetGroup.nCachedObjects_,o=this._bindings[r];o!==void 0&&o.getValue(t,e)}setValue(t,e){let r=this._bindings;for(let o=this._targetGroup.nCachedObjects_,l=r.length;o!==l;++o)r[o].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,r=t.length;e!==r;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,r=t.length;e!==r;++e)t[e].unbind()}},rt=class i{constructor(t,e,r){this.path=e,this.parsedPath=r||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,r){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,r):new i(t,e,r)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(ru,"")}static parseTrackName(t){let e=uu.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let r={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},o=r.nodeName&&r.nodeName.lastIndexOf(".");if(o!==void 0&&o!==-1){let l=r.nodeName.substring(o+1);hu.indexOf(l)!==-1&&(r.nodeName=r.nodeName.substring(0,o),r.objectName=l)}if(r.propertyName===null||r.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return r}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let r=t.skeleton.getBoneByName(e);if(r!==void 0)return r}if(t.children){let r=function(l){for(let c=0;c<l.length;c++){let f=l[c];if(f.name===e||f.uuid===e)return f;let h=r(f.children);if(h)return h}return null},o=r(t.children);if(o)return o}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let r=this.resolvedProperty;for(let o=0,l=r.length;o!==l;++o)t[e++]=r[o]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let r=this.resolvedProperty;for(let o=0,l=r.length;o!==l;++o)r[o]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let r=this.resolvedProperty;for(let o=0,l=r.length;o!==l;++o)r[o]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let r=this.resolvedProperty;for(let o=0,l=r.length;o!==l;++o)r[o]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,r=e.objectName,o=e.propertyName,l=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){ht("PropertyBinding: No target node found for track: "+this.path+".");return}if(r){let p=e.objectIndex;switch(r){case"materials":if(!t.material){ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){ot("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){ot("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let m=0;m<t.length;m++)if(t[m].name===p){p=m;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){ot("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[r]===void 0){ot("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[r]}if(p!==void 0){if(t[p]===void 0){ot("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[p]}}let c=t[o];if(c===void 0){let p=e.nodeName;ot("PropertyBinding: Trying to update property for track: "+p+"."+o+" but it wasn't found.",t);return}let f=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?f=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(f=this.Versioning.MatrixWorldNeedsUpdate);let h=this.BindingType.Direct;if(l!==void 0){if(o==="morphTargetInfluences"){if(!t.geometry){ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[l]!==void 0&&(l=t.morphTargetDictionary[l])}h=this.BindingType.ArrayElement,this.resolvedProperty=c,this.propertyIndex=l}else c.fromArray!==void 0&&c.toArray!==void 0?(h=this.BindingType.HasFromToArray,this.resolvedProperty=c):Array.isArray(c)?(h=this.BindingType.EntireArray,this.resolvedProperty=c):this.propertyName=o;this.getValue=this.GetterByBindingType[h],this.setValue=this.SetterByBindingTypeAndVersioning[h][f]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};rt.Composite=Jr;rt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};rt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};rt.prototype.GetterByBindingType=[rt.prototype._getValue_direct,rt.prototype._getValue_array,rt.prototype._getValue_arrayElement,rt.prototype._getValue_toArray];rt.prototype.SetterByBindingTypeAndVersioning=[[rt.prototype._setValue_direct,rt.prototype._setValue_direct_setNeedsUpdate,rt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_array,rt.prototype._setValue_array_setNeedsUpdate,rt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_arrayElement,rt.prototype._setValue_arrayElement_setNeedsUpdate,rt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_fromArray,rt.prototype._setValue_fromArray_setNeedsUpdate,rt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var mp=new Float32Array(1);var Kr=class i{static{i.prototype.isMatrix2=!0}constructor(t,e,r,o){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,r,o)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let r=0;r<4;r++)this.elements[r]=t[r+e];return this}set(t,e,r,o){let l=this.elements;return l[0]=t,l[2]=e,l[1]=r,l[3]=o,this}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?ht("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");var _u=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,yu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,vu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Su=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Mu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,bu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Eu=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Tu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,wu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Au=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Cu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Pu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Iu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Ru=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Lu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Nu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Du=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ou=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Fu=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Bu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Uu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,zu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,ku=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Vu=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Hu=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Gu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Xu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Wu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Yu=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,qu=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Zu="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ju=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Ku=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,$u=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,ju=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Qu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,th=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,eh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,nh=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,ih=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,rh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,sh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,oh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ah=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ch=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,uh=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,hh=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,fh=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,dh=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,ph=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,mh=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,gh=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,xh=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,_h=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,yh=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,vh=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Sh=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Mh=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,bh=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Eh=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Th=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,wh=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ah=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ch=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ph=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ih=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Rh=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Lh=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Nh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Dh=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Oh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Bh=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Uh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,zh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,kh=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Vh=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Hh=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Gh=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Xh=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Wh=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Yh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,qh=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Zh=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Jh=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Kh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$h=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,jh=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Qh=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,tf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,ef=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,nf=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,rf=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,sf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,of=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,af=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,lf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,cf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,uf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,hf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,ff=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,df=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,pf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,mf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,gf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,xf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,_f=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,yf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,vf=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Sf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Mf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Ef=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Tf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,wf=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Af=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Cf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Pf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,If=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Rf=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Lf=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Nf=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Df=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Of=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ff=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Bf=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Uf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,zf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,kf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Vf=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Hf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Gf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Xf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Yf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qf=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Zf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Jf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Kf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,$f=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,jf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,j={alphahash_fragment:_u,alphahash_pars_fragment:yu,alphamap_fragment:vu,alphamap_pars_fragment:Su,alphatest_fragment:Mu,alphatest_pars_fragment:bu,aomap_fragment:Eu,aomap_pars_fragment:Tu,batching_pars_vertex:wu,batching_vertex:Au,begin_vertex:Cu,beginnormal_vertex:Pu,bsdfs:Iu,iridescence_fragment:Ru,bumpmap_pars_fragment:Lu,clipping_planes_fragment:Nu,clipping_planes_pars_fragment:Du,clipping_planes_pars_vertex:Ou,clipping_planes_vertex:Fu,color_fragment:Bu,color_pars_fragment:Uu,color_pars_vertex:zu,color_vertex:ku,common:Vu,cube_uv_reflection_fragment:Hu,defaultnormal_vertex:Gu,displacementmap_pars_vertex:Xu,displacementmap_vertex:Wu,emissivemap_fragment:Yu,emissivemap_pars_fragment:qu,colorspace_fragment:Zu,colorspace_pars_fragment:Ju,envmap_fragment:Ku,envmap_common_pars_fragment:$u,envmap_pars_fragment:ju,envmap_pars_vertex:Qu,envmap_physical_pars_fragment:uh,envmap_vertex:th,fog_vertex:eh,fog_pars_vertex:nh,fog_fragment:ih,fog_pars_fragment:rh,gradientmap_pars_fragment:sh,lightmap_pars_fragment:oh,lights_lambert_fragment:ah,lights_lambert_pars_fragment:lh,lights_pars_begin:ch,lights_toon_fragment:hh,lights_toon_pars_fragment:fh,lights_phong_fragment:dh,lights_phong_pars_fragment:ph,lights_physical_fragment:mh,lights_physical_pars_fragment:gh,lights_fragment_begin:xh,lights_fragment_maps:_h,lights_fragment_end:yh,lightprobes_pars_fragment:vh,logdepthbuf_fragment:Sh,logdepthbuf_pars_fragment:Mh,logdepthbuf_pars_vertex:bh,logdepthbuf_vertex:Eh,map_fragment:Th,map_pars_fragment:wh,map_particle_fragment:Ah,map_particle_pars_fragment:Ch,metalnessmap_fragment:Ph,metalnessmap_pars_fragment:Ih,morphinstance_vertex:Rh,morphcolor_vertex:Lh,morphnormal_vertex:Nh,morphtarget_pars_vertex:Dh,morphtarget_vertex:Oh,normal_fragment_begin:Fh,normal_fragment_maps:Bh,normal_pars_fragment:Uh,normal_pars_vertex:zh,normal_vertex:kh,normalmap_pars_fragment:Vh,clearcoat_normal_fragment_begin:Hh,clearcoat_normal_fragment_maps:Gh,clearcoat_pars_fragment:Xh,iridescence_pars_fragment:Wh,opaque_fragment:Yh,packing:qh,premultiplied_alpha_fragment:Zh,project_vertex:Jh,dithering_fragment:Kh,dithering_pars_fragment:$h,roughnessmap_fragment:jh,roughnessmap_pars_fragment:Qh,shadowmap_pars_fragment:tf,shadowmap_pars_vertex:ef,shadowmap_vertex:nf,shadowmask_pars_fragment:rf,skinbase_vertex:sf,skinning_pars_vertex:of,skinning_vertex:af,skinnormal_vertex:lf,specularmap_fragment:cf,specularmap_pars_fragment:uf,tonemapping_fragment:hf,tonemapping_pars_fragment:ff,transmission_fragment:df,transmission_pars_fragment:pf,uv_pars_fragment:mf,uv_pars_vertex:gf,uv_vertex:xf,worldpos_vertex:_f,background_vert:yf,background_frag:vf,backgroundCube_vert:Sf,backgroundCube_frag:Mf,cube_vert:bf,cube_frag:Ef,depth_vert:Tf,depth_frag:wf,distance_vert:Af,distance_frag:Cf,equirect_vert:Pf,equirect_frag:If,linedashed_vert:Rf,linedashed_frag:Lf,meshbasic_vert:Nf,meshbasic_frag:Df,meshlambert_vert:Of,meshlambert_frag:Ff,meshmatcap_vert:Bf,meshmatcap_frag:Uf,meshnormal_vert:zf,meshnormal_frag:kf,meshphong_vert:Vf,meshphong_frag:Hf,meshphysical_vert:Gf,meshphysical_frag:Xf,meshtoon_vert:Wf,meshtoon_frag:Yf,points_vert:qf,points_frag:Zf,shadow_vert:Jf,shadow_frag:Kf,sprite_vert:$f,sprite_frag:jf},U={common:{diffuse:{value:new ut(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new q},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new q}},envmap:{envMap:{value:null},envMapRotation:{value:new q},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new q}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new q}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new q},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new q},normalScale:{value:new V(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new q},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new q}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new q}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new q}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ut(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new T},probesMax:{value:new T},probesResolution:{value:new T}},points:{diffuse:{value:new ut(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0},uvTransform:{value:new q}},sprite:{diffuse:{value:new ut(16777215)},opacity:{value:1},center:{value:new V(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new q},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0}}},Oo={basic:{uniforms:Mt([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.fog]),vertexShader:j.meshbasic_vert,fragmentShader:j.meshbasic_frag},lambert:{uniforms:Mt([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.fog,U.lights,{emissive:{value:new ut(0)},envMapIntensity:{value:1}}]),vertexShader:j.meshlambert_vert,fragmentShader:j.meshlambert_frag},phong:{uniforms:Mt([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.fog,U.lights,{emissive:{value:new ut(0)},specular:{value:new ut(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:j.meshphong_vert,fragmentShader:j.meshphong_frag},standard:{uniforms:Mt([U.common,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.roughnessmap,U.metalnessmap,U.fog,U.lights,{emissive:{value:new ut(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:j.meshphysical_vert,fragmentShader:j.meshphysical_frag},toon:{uniforms:Mt([U.common,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.gradientmap,U.fog,U.lights,{emissive:{value:new ut(0)}}]),vertexShader:j.meshtoon_vert,fragmentShader:j.meshtoon_frag},matcap:{uniforms:Mt([U.common,U.bumpmap,U.normalmap,U.displacementmap,U.fog,{matcap:{value:null}}]),vertexShader:j.meshmatcap_vert,fragmentShader:j.meshmatcap_frag},points:{uniforms:Mt([U.points,U.fog]),vertexShader:j.points_vert,fragmentShader:j.points_frag},dashed:{uniforms:Mt([U.common,U.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:j.linedashed_vert,fragmentShader:j.linedashed_frag},depth:{uniforms:Mt([U.common,U.displacementmap]),vertexShader:j.depth_vert,fragmentShader:j.depth_frag},normal:{uniforms:Mt([U.common,U.bumpmap,U.normalmap,U.displacementmap,{opacity:{value:1}}]),vertexShader:j.meshnormal_vert,fragmentShader:j.meshnormal_frag},sprite:{uniforms:Mt([U.sprite,U.fog]),vertexShader:j.sprite_vert,fragmentShader:j.sprite_frag},background:{uniforms:{uvTransform:{value:new q},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:j.background_vert,fragmentShader:j.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new q}},vertexShader:j.backgroundCube_vert,fragmentShader:j.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:j.cube_vert,fragmentShader:j.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:j.equirect_vert,fragmentShader:j.equirect_frag},distance:{uniforms:Mt([U.common,U.displacementmap,{referencePosition:{value:new T},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:j.distance_vert,fragmentShader:j.distance_frag},shadow:{uniforms:Mt([U.lights,U.fog,{color:{value:new ut(0)},opacity:{value:1}}]),vertexShader:j.shadow_vert,fragmentShader:j.shadow_frag}};Oo.physical={uniforms:Mt([Oo.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new q},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new q},clearcoatNormalScale:{value:new V(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new q},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new q},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new q},sheen:{value:0},sheenColor:{value:new ut(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new q},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new q},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new q},transmissionSamplerSize:{value:new V},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new q},attenuationDistance:{value:0},attenuationColor:{value:new ut(0)},specularColor:{value:new ut(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new q},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new q},anisotropyVector:{value:new V},anisotropyMap:{value:null},anisotropyMapTransform:{value:new q}}]),vertexShader:j.meshphysical_vert,fragmentShader:j.meshphysical_frag};var Qf=new q;Qf.set(-1,0,0,0,1,0,0,0,1);var ly={[jr]:"LINEAR_TONE_MAPPING",[Qr]:"REINHARD_TONE_MAPPING",[ts]:"CINEON_TONE_MAPPING",[es]:"ACES_FILMIC_TONE_MAPPING",[is]:"AGX_TONE_MAPPING",[rs]:"NEUTRAL_TONE_MAPPING",[ns]:"CUSTOM_TONE_MAPPING"};var cy=new Float32Array(16),uy=new Float32Array(9),hy=new Float32Array(4);var fy={[jr]:"Linear",[Qr]:"Reinhard",[ts]:"Cineon",[es]:"ACESFilmic",[is]:"AgX",[rs]:"Neutral",[ns]:"Custom"};var dy={[ao]:"SHADOWMAP_TYPE_PCF",[lo]:"SHADOWMAP_TYPE_VSM"};var py={[xo]:"ENVMAP_TYPE_CUBE",[os]:"ENVMAP_TYPE_CUBE",[_o]:"ENVMAP_TYPE_CUBE_UV"};var my={[os]:"ENVMAP_MODE_REFRACTION"};var gy={[$r]:"ENVMAP_BLENDING_MULTIPLY",[mo]:"ENVMAP_BLENDING_MIX",[go]:"ENVMAP_BLENDING_ADD"};var td=new q;td.set(-1,0,0,0,1,0,0,0,1);var xy=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);var Fo=Object.freeze({version:1,zero:1e-9,topology:1e-7,contact:1e-6,angular:1e-6,relativeVolume:1e-8,minVolume:1e-8,microMax:.01,microMin:1e-5}),yy=Object.freeze([0,Fo.contact]);var ed=new WeakMap;function Ce(i){return i?ed.get(i)||i.attributes.position:void 0}function Bo(i){let t=i.clone(),e=Ce(i);return t.setAttribute("position",e.clone()),t}function id(i,t){let e=i.points,r=t==="start"?0:e.length-1,o=e[r],l=e[t==="start"?1:r-1],c=t==="start"?l[0]-o[0]:o[0]-l[0],f=t==="start"?l[1]-o[1]:o[1]-l[1],h=Math.hypot(c,f);return{point:o,angle:i.tangents?.[t]??Math.atan2(f,c)*180/Math.PI,length:h,handleLength:i.tangentLengths?.[t]??h/3}}function rd(i){let t=new en(i.points.map(l=>new T(...l,0)),!!i.closed,"centripetal");if(i.closed||!["start","end"].some(l=>Number.isFinite(i.tangents?.[l])||Number.isFinite(i.tangentLengths?.[l])))return t;let e=i.points.length-1,r={};for(let l of["start","end"])if(Number.isFinite(i.tangents?.[l])||Number.isFinite(i.tangentLengths?.[l])){let{angle:c,handleLength:f}=id(i,l),h=c*Math.PI/180,p=i.points,m=l==="start"?new T(p[1][0]-p[0][0],p[1][1]-p[0][1],0):new T(p.at(-1)[0]-p.at(-2)[0],p.at(-1)[1]-p.at(-2)[1],0);r[l]=new T(Math.cos(h)*f*3,Math.sin(h)*f*3,0).sub(m)}let o=new St;return o.getPoint=(l,c=new T)=>{t.getPoint(l,c);let f=l*e;if(r.start&&f<=1&&c.addScaledVector(r.start,f*(1-f)*(1-f)),r.end&&f>=e-1){let h=f-(e-1);c.addScaledVector(r.end,h*h*(h-1))}return c},o}function Uo(i){return i.points.length<2?i.points.map(t=>[...t]):rd(i).getPoints(Math.max(32,i.points.length*16)).map(t=>[t.x,t.y])}var od=Kn(Wi(),1);function Tt(i){return i.frame?Object.fromEntries(["u","v","n"].map(t=>[t,new T(...i.frame[t])])):i.plane==="XZ"?{u:new T(1,0,0),v:new T(0,0,-1),n:new T(0,1,0)}:i.plane==="YZ"?{u:new T(0,0,-1),v:new T(0,1,0),n:new T(1,0,0)}:{u:new T(1,0,0),v:new T(0,1,0),n:new T(0,0,1)}}function Fn(i){if(!i||["u","v","n"].some(o=>!Array.isArray(i[o])||i[o].length!==3||i[o].some(l=>!Number.isFinite(l))))throw Error("\u4F5C\u56F3\u5E73\u9762\u304C\u4E0D\u6B63\u3067\u3059");let{u:t,v:e,n:r}=Tt({frame:i});if([t,e,r].some(o=>Math.abs(o.length()-1)>1e-5)||t.clone().cross(e).distanceTo(r)>1e-5)throw Error("\u4F5C\u56F3\u5E73\u9762\u306E\u8EF8\u304C\u4E0D\u6B63\u3067\u3059")}function zo(i){let t=Tt(i);return new lt().makeBasis(t.u,t.v,t.n)}var de=Kn(Wi(),1),gt=1e-6,Yi=1e5,on=(i,t)=>i[0]*t[1]-i[1]*t[0],te=(i,t)=>[i[0]-t[0],i[1]-t[1]],Pe=(i,t)=>i[0]*t[0]+i[1]*t[1],hs=i=>i.reduce((t,e,r)=>t+on(e,i[(r+1)%i.length]),0)/2;function ad(i,t){let e=!1;for(let r=0,o=t.length-1;r<t.length;o=r++){let l=t[r],c=t[o];l[1]>i[1]!=c[1]>i[1]&&i[0]<(c[0]-l[0])*(i[1]-l[1])/(c[1]-l[1])+l[0]&&(e=!e)}return e}function fs(i){if(i.frame){let t=Tt(i),e=new T(i.x,i.y,i.z);return{u:e.dot(t.u),v:e.dot(t.v),offset:e.dot(t.n)}}return i.plane==="XY"?{u:i.x,v:i.y,offset:i.z}:i.plane==="XZ"?{u:i.x,v:-i.z,offset:i.y}:{u:-i.z,v:i.y,offset:i.x}}function ld(i){if(i.profile==="point"){let c=fs(i);return[[c.u,c.v]]}let t=[];if(i.profile==="polyline"){let c=i.points.map(f=>[...f]);return i.closed&&c.push([...c[0]]),c}if(i.profile==="spline")return Uo(i);if(i.profile==="line")t.push([-i.width/2,0],[i.width/2,0]);else if(i.profile==="rect")t.push([-i.width/2,-i.height/2],[i.width/2,-i.height/2],[i.width/2,i.height/2],[-i.width/2,i.height/2],[-i.width/2,-i.height/2]);else if(i.profile==="circle")for(let c=0;c<=128;c++)t.push([Math.cos(c*Math.PI/64)*i.diameter/2,Math.sin(c*Math.PI/64)*i.diameter/2]);let e=i.angle*Math.PI/180,r=Math.cos(e),o=Math.sin(e),l=fs(i);return t.map(([c,f])=>[l.u+c*r-f*o,l.v+c*o+f*r])}var ds=i=>Math.round(i[0]/gt)+","+Math.round(i[1]/gt),ko=(i,t)=>[i.a[0]+(i.b[0]-i.a[0])*t,i.a[1]+(i.b[1]-i.a[1])*t];function cd(i,t){let e=te(i.b,i.a),r=te(t.b,t.a),o=te(t.a,i.a),l=on(e,r);if(Math.abs(l)>1e-10){let c=on(o,r)/l,f=on(o,e)/l;c>=-gt&&c<=1+gt&&f>=-gt&&f<=1+gt&&(i.ts.push(Math.max(0,Math.min(1,c))),t.ts.push(Math.max(0,Math.min(1,f))))}else if(Math.abs(on(o,e))<gt*Math.sqrt(Pe(e,e))){for(let c of[t.a,t.b]){let f=Pe(te(c,i.a),e)/Pe(e,e);f>0&&f<1&&i.ts.push(f)}for(let c of[i.a,i.b]){let f=Pe(te(c,t.a),r)/Pe(r,r);f>0&&f<1&&t.ts.push(f)}}}function ud(i){let t=i.map(m=>({...m,ts:[0,1],minX:Math.min(m.a[0],m.b[0]),maxX:Math.max(m.a[0],m.b[0]),minY:Math.min(m.a[1],m.b[1]),maxY:Math.max(m.a[1],m.b[1])})).sort((m,x)=>m.minX-x.minX),e=[];for(let m of t){e=e.filter(x=>x.maxX>=m.minX-gt);for(let x of e)x.maxY>=m.minY-gt&&x.minY<=m.maxY+gt&&cd(x,m);e.push(m)}let r=new Map,o=new Map,l=m=>{let x=ds(m);return r.has(x)||r.set(x,{key:x,p:m,neighbors:new Set}),r.get(x)};for(let m of t){m.ts.sort((x,_)=>x-_);for(let x=1;x<m.ts.length;x++){let _=l(ko(m,m.ts[x-1])),v=l(ko(m,m.ts[x]));if(_.key===v.key)continue;let S=[_.key,v.key].sort().join("|");o.has(S)||(o.set(S,[_,v]),_.neighbors.add(v),v.neighbors.add(_))}}let c=0,f=[];for(let m of r.values()){if(m.disc)continue;m.disc=m.low=++c;let x=[{n:m,parent:null,next:[...m.neighbors],i:0}];for(;x.length;){let _=x.at(-1);if(_.i<_.next.length){let v=_.next[_.i++];if(v===_.parent)continue;v.disc?_.n.low=Math.min(_.n.low,v.disc):(v.disc=v.low=++c,x.push({n:v,parent:_.n,next:[...v.neighbors],i:0}))}else x.pop(),_.parent&&(_.parent.low=Math.min(_.parent.low,_.n.low),_.n.low>_.parent.disc&&f.push([_.n,_.parent]))}}for(let[m,x]of f)m.neighbors.delete(x),x.neighbors.delete(m);for(let m of r.values())m.order=[...m.neighbors].sort((x,_)=>Math.atan2(x.p[1]-m.p[1],x.p[0]-m.p[0])-Math.atan2(_.p[1]-m.p[1],_.p[0]-m.p[0]));let h=new Set,p=[];for(let m of r.values())for(let x of m.order){let _=m,v=x,S=[],E=m.key+">"+x.key;if(!h.has(E)){for(let w=0;w<o.size*2+2;w++){let P=_.key+">"+v.key;if(h.has(P))break;h.add(P),S.push(_.p);let N=v.order,C=N.indexOf(_),I=N[(C-1+N.length)%N.length];if(_=v,v=I,_===m&&v===x)break}_===m&&v===x&&S.length>=3&&hs(S)>1e-7&&p.push(S)}}return p}function hd(i){let t=i[0],e=i[1],r=te(e,t),o=Math.hypot(...r),l=Math.min(o*1e-5,1e-4);return[(t[0]+e[0])/2-r[1]/o*l,(t[1]+e[1])/2+r[0]/o*l]}function fd(i){let t=2166136261;for(let e=0;e<i.length;e++)t=Math.imul(t^i.charCodeAt(e),16777619);return(t>>>0).toString(36)}function Vo(i){let t=i.map(ds),e=t.reduce((r,o,l)=>o<t[r]?l:r,0);return[...t.slice(e),...t.slice(0,e)].join(";")}function dd(i){let t=new Set,e=!1;for(let h of i)for(let p of h){let m=ds(p);t.has(m)&&(e=!0),t.add(m)}if(!e)return i;let r=new Map,o=i.map(h=>{let p=h.map(m=>{let x=Math.round(m[0]*Yi),_=Math.round(m[1]*Yi);return r.set(x+","+_,m),{X:x,Y:_}});return de.default.Clipper.Orientation(p)||p.reverse(),p}),l=new de.default.Clipper;l.StrictlySimple=!0,l.PreserveCollinear=!0,l.AddPaths(o,de.default.PolyType.ptSubject,!0);let c=new de.default.PolyTree;l.Execute(de.default.ClipType.ctUnion,c,de.default.PolyFillType.pftNonZero,de.default.PolyFillType.pftNonZero);let f=[];for(let h=c.GetFirst();h;h=h.GetNext())h.IsHole()||f.push(h.Contour().map(({X:p,Y:m})=>r.get(p+","+m)||[p/Yi,m/Yi]));return f}function Go(i){let t=new Set(i.filter(o=>o.textOutline?.hole===!0&&typeof o.textOutline.id=="string").map(o=>o.id)),e=new Map;for(let o of i.filter(l=>l.kind==="sketch"&&!l.construction)){let l=Tt(o),c=fs(o),f=l.n.clone(),h=f.toArray(),p=h.reduce((E,w,P)=>Math.abs(w)>Math.abs(h[E])?P:E,0);h[p]<0&&f.negate();let m=c.offset*l.n.dot(f),x=f.toArray().map(E=>Math.round(E/gt)).join(",")+":"+Math.round(m/gt);if(!e.has(x)){let E="CUSTOM",w;for(let P of["XY","XZ","YZ"])Tt({plane:P}).n.distanceTo(f)<gt&&(E=P);if(E==="CUSTOM"){let P=Math.abs(f.z)<.9?new T(0,0,1):new T(0,1,0),N=P.cross(f).normalize(),C=f.clone().cross(N);w={u:N.toArray(),v:C.toArray(),n:f.toArray()}}e.set(x,{plane:E,frame:w,offset:m,segments:[],sourceIds:[]})}let _=e.get(x),v=Tt(_),S=ld(o).map(([E,w])=>{let P=l.u.clone().multiplyScalar(E).addScaledVector(l.v,w).addScaledVector(l.n,c.offset);return[P.dot(v.u),P.dot(v.v)]});_.sourceIds.push(o.id);for(let E=1;E<S.length;E++)Math.hypot(...te(S[E],S[E-1]))>gt&&_.segments.push({a:S[E-1],b:S[E],sourceId:o.id})}let r=[];for(let[o,l]of e){if(l.segments.length>2e4)throw Error("\u30B9\u30B1\u30C3\u30C1\u304C\u8907\u96D1\u3059\u304E\u307E\u3059\u3002\u7DDA\u306E\u6570\u3092\u6E1B\u3089\u3057\u3066\u304F\u3060\u3055\u3044\u3002");let f=ud(l.segments).map(h=>({outer:h,holes:[],area:hs(h),parent:null}));for(let h of f){let p=hd(h.outer),m=f.filter(x=>x.area>h.area+gt&&ad(p,x.outer));m.length&&(h.parent=m.sort((x,_)=>x.area-_.area)[0],h.parent.holes.push(h.outer))}for(let h of f){h.holes=dd(h.holes);let p=h.area-h.holes.reduce((m,x)=>m+Math.abs(hs(x)),0);if(!(p<1e-6)){if(t.size){let m=Ho({outer:h.outer,holes:[]},l.segments);if(m.length&&m.every(x=>t.has(x)))continue}r.push({id:o+":"+fd(Vo(h.outer)+h.holes.map(Vo).sort().join("/")),plane:l.plane,frame:l.frame,offset:l.offset,outer:h.outer,holes:h.holes,area:p,sourceIds:Ho(h,l.segments)})}}}return r}function pd(i){if(!i||!["XY","XZ","YZ","CUSTOM"].includes(i.plane)||!Number.isFinite(i.offset)||Math.abs(i.offset)>1e4||!Array.isArray(i.outer)||!Array.isArray(i.holes)||i.holes.length>150)throw Error("\u9818\u57DF\u30C7\u30FC\u30BF\u304C\u4E0D\u6B63\u3067\u3059\u3002");i.plane==="CUSTOM"&&Fn(i.frame);let t=0;for(let e of[i.outer,...i.holes])if(!Array.isArray(e)||e.length<3||(t+=e.length)>2e4||e.some(r=>!Array.isArray(r)||r.length!==2||r.some(o=>!Number.isFinite(o)||Math.abs(o)>25e3)))throw Error("\u8F2A\u90ED\u30C7\u30FC\u30BF\u304C\u4E0D\u6B63\u3067\u3059\u3002");return i}function md(i){let t=new nn(i.outer.map(e=>new V(...e)));for(let e of i.holes)t.holes.push(new Te(e.map(r=>new V(...r))));return t}function gd(i,t){if(t.frame){let e=Tt(t);return i.applyMatrix4(zo(t)),i.translate(...e.n.multiplyScalar(t.offset).toArray()),i}return t.plane==="XZ"&&i.rotateX(-Math.PI/2),t.plane==="YZ"&&i.rotateY(Math.PI/2),t.plane==="XY"?i.translate(0,0,t.offset):t.plane==="XZ"?i.translate(0,t.offset,0):i.translate(t.offset,0,0),i}function Xo(i){return pd(i),gd(new Dn(md(i)),i)}function Ho(i,t){let e=new Set;for(let r of[i.outer,...i.holes])for(let o=0;o<r.length;o++){let l=r[o],c=r[(o+1)%r.length],f=[(l[0]+c[0])/2,(l[1]+c[1])/2];for(let h of t){let p=te(h.b,h.a),m=te(f,h.a),x=Pe(p,p),_=Pe(m,p)/x;_>=-gt&&_<=1+gt&&Math.abs(on(m,p))<=gt*Math.sqrt(x)&&e.add(h.sourceId)}}return[...e].sort()}var ct=Kn(Wi(),1);function qi(i,t,{precision:e=!1}={}){let r=t.normal,o=new T(Math.abs(r.x)<.9?1:0,Math.abs(r.x)<.9?0:1,0);o.addScaledVector(r,-o.dot(r)).normalize();let l=r.clone().cross(o),c=[],f=new Map,h=new Set,p=1e-5;function m(C){let I=new T(...C),D=new V(I.dot(o),I.dot(l)),B=Math.floor(D.x/p),z=Math.floor(D.y/p),O=-1,X=p*p;for(let Q=-1;Q<=1;Q++)for(let W=-1;W<=1;W++)for(let tt of f.get(B+Q+","+(z+W))||[]){let Y=c[tt].p.distanceToSquared(D);Y<=X&&(O=tt,X=Y)}if(O>=0)return O;let k=c.length,H=B+","+z;return c.push({p:D,links:new Set}),f.has(H)||f.set(H,[]),f.get(H).push(k),k}for(let C=0;C<i.length;C+=6){let I=m(i.slice(C,C+3)),D=m(i.slice(C+3,C+6)),B=Math.min(I,D)+","+Math.max(I,D);I===D||h.has(B)||(h.add(B),c[I].links.add(D),c[D].links.add(I))}let x=c.flatMap((C,I)=>C.links.size<2?[I]:[]);for(;x.length;){let C=x.pop(),I=c[C];if(!(I.links.size>1)){for(let D of I.links)c[D].links.delete(C),c[D].links.size===1&&x.push(D);I.links.clear()}}let _=c.map(C=>[...C.links].sort((I,D)=>Math.atan2(c[I].p.y-C.p.y,c[I].p.x-C.p.x)-Math.atan2(c[D].p.y-C.p.y,c[D].p.x-C.p.x))),v=new Set,S=[];for(let C=0;C<c.length;C++)for(let I of _[C]){if(v.has(C+","+I))continue;let D=C,B=I,z=!1,O=[];for(let W=0;W<=h.size*2;W++){let tt=D+","+B;if(v.has(tt)){z=D===C&&B===I;break}v.add(tt),O.push(c[D].p);let Y=_[B],pt=Y.indexOf(D),xt=Y[(pt+Y.length-1)%Y.length];D=B,B=xt}let X=Dt.area(O);if(!z||O.length<3||X<=1e-12)continue;let k=Dt.triangulateShape(O,[]),H=null,Q=0;for(let[W,tt,Y]of k){let pt=Math.abs((O[tt].x-O[W].x)*(O[Y].y-O[W].y)-(O[tt].y-O[W].y)*(O[Y].x-O[W].x));pt>Q&&(Q=pt,H=O[W].clone().add(O[tt]).add(O[Y]).multiplyScalar(1/3))}H&&S.push({points:O,area:X,sample:H})}let E=(C,I)=>{let D=!1;for(let B=0,z=I.length-1;B<I.length;z=B++){let O=I[B],X=I[z];O.y>C.y!=X.y>C.y&&C.x<(X.x-O.x)*(C.y-O.y)/(X.y-O.y)+O.x&&(D=!D)}return D},w=S.map(C=>S.filter(I=>I.area>C.area&&E(C.sample,I.points)).length),P=[];for(let C=0;C<S.length;C++){if(w[C]%2)continue;let I=S[C].points,D=S.filter((z,O)=>w[O]===w[C]+1&&E(z.sample,I)).map(z=>z.points),B=[I,...D].flat();for(let z of Dt.triangulateShape(I,D))for(let O of z){let X=B[O];P.push(...o.clone().multiplyScalar(X.x).addScaledVector(l,X.y).addScaledVector(r,-t.constant).toArray())}}let N=new Wt;return N.setAttribute("position",e?new Pt(new Float64Array(P),3):new Xt(P,3)),N.computeVertexNormals(),N}var _v=Object.freeze({purpose:"thread-display",version:1,tolerance:.1,angularTolerance:.35}),yv=Object.freeze({tolerance:.02,angularTolerance:.12});var _d="transparent";var Sv=_d+":";var op=Kn(Oa(),1);var ap={"z+":new lt,"z-":new lt().makeRotationX(Math.PI),"x+":new lt().makeRotationY(-Math.PI/2),"x-":new lt().makeRotationY(Math.PI/2),"y+":new lt().makeRotationX(Math.PI/2),"y-":new lt().makeRotationX(-Math.PI/2)};for(let i of Object.values(ap))i.elements=i.elements.map(Math.round);var Jv=new lt().set(0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1),Kv=new lt;function Ua(i,t){let e=Ce(i),r=i.index,o=[],l=r?r.count:e.count;for(let c=0;c<l;c+=3){let f=[0,1,2].map(x=>new T().fromBufferAttribute(e,r?r.getX(c+x):c+x)),h=f.map(x=>{let _=t.distanceToPoint(x);return Math.abs(_)<1e-7?0:_}),p=[];if(h.every(x=>x===0))continue;for(let x=0;x<3;x++){let _=(x+1)%3;h[x]===0?p.push(f[x]):h[x]*h[_]<0&&p.push(f[x].clone().lerp(f[_],h[x]/(h[x]-h[_])))}let m=p.filter((x,_)=>!p.slice(0,_).some(v=>v.distanceToSquared(x)<1e-12));m.length===2&&o.push(...m[0].toArray(),...m[1].toArray())}return o}var Ne=1e5;function Xn(i,t=!0){let e=i.map(([r,o])=>({X:Math.round(r*Ne),Y:Math.round(o*Ne)}));return ct.default.Clipper.Orientation(e)!==t&&e.reverse(),e}function fp(i,t,e,{nativeSegments:r=null,heal:o=!0}={}){let l=[];for(let h of i){if(!h.visible)continue;h.updateWorldMatrix(!0,!1);let p=Bo(h.geometry).applyMatrix4(h.matrixWorld),m=new Ee(t.n,-e),x=Ua(p,m),_=qi(x,m,{precision:p.attributes.position.array instanceof Float64Array});if(r)for(let v=0;v<x.length;v+=6){let S=new T(...x.slice(v,v+3)),E=new T(...x.slice(v+3,v+6));r.push([[S.dot(t.u),S.dot(t.v)],[E.dot(t.u),E.dot(t.v)]])}try{for(let v of[p,_]){let S=v.attributes.position,E=v.index;for(let w=0;w<(E?.count??S.count);w+=3){let P=[0,1,2].map(C=>new T().fromBufferAttribute(S,E?E.getX(w+C):w+C));if(P.some(C=>Math.abs(m.distanceToPoint(C))>1e-4))continue;let N=Xn(P.map(C=>[C.dot(t.u),C.dot(t.v)]));Math.abs(ct.default.Clipper.Area(N))>1&&l.push(N)}}}finally{_.dispose(),p.dispose()}}let c=new ct.default.Clipper;c.AddPaths(l,ct.default.PolyType.ptSubject,!0);let f=[];if(c.Execute(ct.default.ClipType.ctUnion,f,ct.default.PolyFillType.pftNonZero,ct.default.PolyFillType.pftNonZero),o)for(let h of[20,-20]){let p=new ct.default.ClipperOffset(2),m=[];p.AddPaths(f,ct.default.JoinType.jtMiter,ct.default.EndType.etClosedPolygon),p.Execute(m,h),f=m}return f}function za(i,t,{includeOutside:e=!1,includeUnsplit:r=!1}={}){let o=[],l=new Map;for(let c of i){let f=Tt(c),h=[...f.n.toArray(),c.offset,...f.u.toArray(),...f.v.toArray()].join(",");if(!l.has(h)){let _=fp(t,f,c.offset);l.set(h,_)}let p=l.get(h);if(!p.length&&!r)continue;let m=["inside",...e?["outside"]:[]].map(_=>{let v=new ct.default.Clipper,S=new ct.default.PolyTree;return v.AddPaths([Xn(c.outer),...c.holes.map(E=>Xn(E,!1))],ct.default.PolyType.ptSubject,!0),v.AddPaths(p,ct.default.PolyType.ptClip,!0),v.Execute(_==="outside"?ct.default.ClipType.ctDifference:ct.default.ClipType.ctIntersection,S,ct.default.PolyFillType.pftNonZero,ct.default.PolyFillType.pftNonZero),{tree:S,side:_}}),x=[];for(let{tree:_,side:v}of m){let S=0;for(let E=_.GetFirst();E;E=E.GetNext()){if(E.IsHole())continue;let w=E.Contour().map(k=>[k.X/Ne,k.Y/Ne]),P=E.Childs().filter(k=>k.IsHole()).map(k=>k.Contour().map(H=>[H.X/Ne,H.Y/Ne])),N=(Math.abs(ct.default.Clipper.Area(E.Contour()))-E.Childs().filter(k=>k.IsHole()).reduce((k,H)=>k+Math.abs(ct.default.Clipper.Area(H.Contour())),0))/Ne**2;if(N<1e-5||!r&&Math.abs(N-c.area)<Math.max(1e-4,c.area*1e-6))continue;let C=w.map(k=>new V(...k)),I=P.map(k=>k.map(H=>new V(...H))),D=[...w,...P.flat()],z=Dt.triangulateShape(C,I).sort((k,H)=>Math.abs(ct.default.Clipper.Area(Xn(H.map(Q=>D[Q]))))-Math.abs(ct.default.Clipper.Area(Xn(k.map(Q=>D[Q])))))[0];if(!z)continue;let O=z.reduce((k,H)=>[k[0]+D[H][0]/3,k[1]+D[H][1]/3],[0,0]),X=f.u.clone().multiplyScalar(O[0]).addScaledVector(f.v,O[1]).addScaledVector(f.n,c.offset).toArray();x.push({...c,id:c.id+(v==="outside"?":outside:":":overlap:")+S++,outer:w,holes:P,area:N,partitionSide:v,overlapSource:structuredClone(c),overlapPoint:X,overlapTargets:[...new Set(t.filter(k=>k.visible).map(k=>k.userData.bodyId))]})}}for(let _ of x)o.push({..._,partitionCount:x.filter(v=>v.partitionSide===_.partitionSide).length})}return o}function ka({features:i,bodies:t=[]}){let e=[];try{for(let c of t){let f=new Wt().setAttribute("position",new Pt(new Float64Array(c.positions),3));c.indices&&f.setIndex(c.indices);let h=new Qe(f);h.matrixAutoUpdate=!1,h.matrix.fromArray(c.matrix),h.updateMatrixWorld(!0),e.push(h)}let r=Go(i),o=za(r,e,{includeOutside:!0}),l=[...r,...o].map(c=>{let f=Xo(c);try{return{id:c.id,positions:f.attributes.position.array.slice(),indices:f.index?.array.slice()||null}}finally{f.dispose()}});return{regions:r,overlap:o,faces:l}}finally{for(let r of e)r.geometry.dispose(),r.material.dispose()}}self.onmessage=({data:i})=>{try{self.postMessage({id:i.id,result:ka(i.spec)})}catch(t){self.postMessage({id:i.id,error:t.message||String(t)})}};
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
