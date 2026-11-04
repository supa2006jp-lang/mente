var fa=Object.create;var Us=Object.defineProperty;var da=Object.getOwnPropertyDescriptor;var pa=Object.getOwnPropertyNames;var ma=Object.getPrototypeOf,ga=Object.prototype.hasOwnProperty;var _a=(i,t)=>()=>{try{return t||i((t={exports:{}}).exports,t),t.exports}catch(e){throw t=0,e}};var xa=(i,t,e,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of pa(t))!ga.call(i,o)&&o!==e&&Us(i,o,{get:()=>t[o],enumerable:!(s=da(t,o))||s.enumerable});return i};var bi=(i,t,e)=>(e=i!=null?fa(ma(i)):{},xa(t||!i||!i.__esModule?Us(e,"default",{value:i,enumerable:!0}):e,i));var xi=_a((Y0,_i)=>{(function(){"use strict";var i={};i.version="6.4.2.2",i.use_lines=!0,i.use_xyz=!1;var t=!1;typeof _i<"u"&&_i.exports?(_i.exports=i,t=!0):(typeof define=="function"&&define.amd&&define(i),typeof document<"u"?window.ClipperLib=i:self.ClipperLib=i);var e;if(t){var s="chrome";e="Netscape"}else{var s=navigator.userAgent.toString().toLowerCase();e=navigator.appName}var o={};s.indexOf("chrome")!=-1&&s.indexOf("chromium")==-1?o.chrome=1:o.chrome=0,s.indexOf("chromium")!=-1?o.chromium=1:o.chromium=0,s.indexOf("safari")!=-1&&s.indexOf("chrome")==-1&&s.indexOf("chromium")==-1?o.safari=1:o.safari=0,s.indexOf("firefox")!=-1?o.firefox=1:o.firefox=0,s.indexOf("firefox/17")!=-1?o.firefox17=1:o.firefox17=0,s.indexOf("firefox/15")!=-1?o.firefox15=1:o.firefox15=0,s.indexOf("firefox/3")!=-1?o.firefox3=1:o.firefox3=0,s.indexOf("opera")!=-1?o.opera=1:o.opera=0,s.indexOf("msie 10")!=-1?o.msie10=1:o.msie10=0,s.indexOf("msie 9")!=-1?o.msie9=1:o.msie9=0,s.indexOf("msie 8")!=-1?o.msie8=1:o.msie8=0,s.indexOf("msie 7")!=-1?o.msie7=1:o.msie7=0,s.indexOf("msie ")!=-1?o.msie=1:o.msie=0,i.biginteger_used=null;var l,h=0xdeadbeefcafe,d=(h&16777215)==15715070;function u(n,r,a){i.biginteger_used=1,n!=null&&(typeof n=="number"&&typeof r>"u"?this.fromInt(n):typeof n=="number"?this.fromNumber(n,r,a):r==null&&typeof n!="string"?this.fromString(n,256):this.fromString(n,r))}function p(){return new u(null,void 0,void 0)}function m(n,r,a,c,f,g){for(;--g>=0;){var x=r*this[n++]+a[c]+f;f=Math.floor(x/67108864),a[c++]=x&67108863}return f}function _(n,r,a,c,f,g){for(var x=r&32767,M=r>>15;--g>=0;){var b=this[n]&32767,w=this[n++]>>15,L=M*b+w*x;b=x*b+((L&32767)<<15)+a[c]+(f&1073741823),f=(b>>>30)+(L>>>15)+M*w+(f>>>30),a[c++]=b&1073741823}return f}function y(n,r,a,c,f,g){for(var x=r&16383,M=r>>14;--g>=0;){var b=this[n]&16383,w=this[n++]>>14,L=M*b+w*x;b=x*b+((L&16383)<<14)+a[c]+f,f=(b>>28)+(L>>14)+M*w,a[c++]=b&268435455}return f}d&&e=="Microsoft Internet Explorer"?(u.prototype.am=_,l=30):d&&e!="Netscape"?(u.prototype.am=m,l=26):(u.prototype.am=y,l=28),u.prototype.DB=l,u.prototype.DM=(1<<l)-1,u.prototype.DV=1<<l;var v=52;u.prototype.FV=Math.pow(2,v),u.prototype.F1=v-l,u.prototype.F2=2*l-v;var S="0123456789abcdefghijklmnopqrstuvwxyz",T=new Array,A,P;for(A=48,P=0;P<=9;++P)T[A++]=P;for(A=97,P=10;P<36;++P)T[A++]=P;for(A=65,P=10;P<36;++P)T[A++]=P;function N(n){return S.charAt(n)}function C(n,r){var a=T[n.charCodeAt(r)];return a??-1}function I(n){for(var r=this.t-1;r>=0;--r)n[r]=this[r];n.t=this.t,n.s=this.s}function D(n){this.t=1,this.s=n<0?-1:0,n>0?this[0]=n:n<-1?this[0]=n+this.DV:this.t=0}function B(n){var r=p();return r.fromInt(n),r}function z(n,r){var a;if(r==16)a=4;else if(r==8)a=3;else if(r==256)a=8;else if(r==2)a=1;else if(r==32)a=5;else if(r==4)a=2;else{this.fromRadix(n,r);return}this.t=0,this.s=0;for(var c=n.length,f=!1,g=0;--c>=0;){var x=a==8?n[c]&255:C(n,c);if(x<0){n.charAt(c)=="-"&&(f=!0);continue}f=!1,g==0?this[this.t++]=x:g+a>this.DB?(this[this.t-1]|=(x&(1<<this.DB-g)-1)<<g,this[this.t++]=x>>this.DB-g):this[this.t-1]|=x<<g,g+=a,g>=this.DB&&(g-=this.DB)}a==8&&(n[0]&128)!=0&&(this.s=-1,g>0&&(this[this.t-1]|=(1<<this.DB-g)-1<<g)),this.clamp(),f&&u.ZERO.subTo(this,this)}function O(){for(var n=this.s&this.DM;this.t>0&&this[this.t-1]==n;)--this.t}function X(n){if(this.s<0)return"-"+this.negate().toString(n);var r;if(n==16)r=4;else if(n==8)r=3;else if(n==2)r=1;else if(n==32)r=5;else if(n==4)r=2;else return this.toRadix(n);var a=(1<<r)-1,c,f=!1,g="",x=this.t,M=this.DB-x*this.DB%r;if(x-- >0)for(M<this.DB&&(c=this[x]>>M)>0&&(f=!0,g=N(c));x>=0;)M<r?(c=(this[x]&(1<<M)-1)<<r-M,c|=this[--x]>>(M+=this.DB-r)):(c=this[x]>>(M-=r)&a,M<=0&&(M+=this.DB,--x)),c>0&&(f=!0),f&&(g+=N(c));return f?g:"0"}function V(){var n=p();return u.ZERO.subTo(this,n),n}function H(){return this.s<0?this.negate():this}function j(n){var r=this.s-n.s;if(r!=0)return r;var a=this.t;if(r=a-n.t,r!=0)return this.s<0?-r:r;for(;--a>=0;)if((r=this[a]-n[a])!=0)return r;return 0}function W(n){var r=1,a;return(a=n>>>16)!=0&&(n=a,r+=16),(a=n>>8)!=0&&(n=a,r+=8),(a=n>>4)!=0&&(n=a,r+=4),(a=n>>2)!=0&&(n=a,r+=2),(a=n>>1)!=0&&(n=a,r+=1),r}function tt(){return this.t<=0?0:this.DB*(this.t-1)+W(this[this.t-1]^this.s&this.DM)}function Y(n,r){var a;for(a=this.t-1;a>=0;--a)r[a+n]=this[a];for(a=n-1;a>=0;--a)r[a]=0;r.t=this.t+n,r.s=this.s}function ct(n,r){for(var a=n;a<this.t;++a)r[a-n]=this[a];r.t=Math.max(this.t-n,0),r.s=this.s}function ft(n,r){var a=n%this.DB,c=this.DB-a,f=(1<<c)-1,g=Math.floor(n/this.DB),x=this.s<<a&this.DM,M;for(M=this.t-1;M>=0;--M)r[M+g+1]=this[M]>>c|x,x=(this[M]&f)<<a;for(M=g-1;M>=0;--M)r[M]=0;r[g]=x,r.t=this.t+g+1,r.s=this.s,r.clamp()}function Mt(n,r){r.s=this.s;var a=Math.floor(n/this.DB);if(a>=this.t){r.t=0;return}var c=n%this.DB,f=this.DB-c,g=(1<<c)-1;r[0]=this[a]>>c;for(var x=a+1;x<this.t;++x)r[x-a-1]|=(this[x]&g)<<f,r[x-a]=this[x]>>c;c>0&&(r[this.t-a-1]|=(this.s&g)<<f),r.t=this.t-a,r.clamp()}function Ot(n,r){for(var a=0,c=0,f=Math.min(n.t,this.t);a<f;)c+=this[a]-n[a],r[a++]=c&this.DM,c>>=this.DB;if(n.t<this.t){for(c-=n.s;a<this.t;)c+=this[a],r[a++]=c&this.DM,c>>=this.DB;c+=this.s}else{for(c+=this.s;a<n.t;)c-=n[a],r[a++]=c&this.DM,c>>=this.DB;c-=n.s}r.s=c<0?-1:0,c<-1?r[a++]=this.DV+c:c>0&&(r[a++]=c),r.t=a,r.clamp()}function Ft(n,r){var a=this.abs(),c=n.abs(),f=a.t;for(r.t=f+c.t;--f>=0;)r[f]=0;for(f=0;f<c.t;++f)r[f+a.t]=a.am(0,c[f],r,f,0,a.t);r.s=0,r.clamp(),this.s!=n.s&&u.ZERO.subTo(r,r)}function $t(n){for(var r=this.abs(),a=n.t=2*r.t;--a>=0;)n[a]=0;for(a=0;a<r.t-1;++a){var c=r.am(a,r[a],n,2*a,0,1);(n[a+r.t]+=r.am(a+1,2*r[a],n,2*a+1,c,r.t-a-1))>=r.DV&&(n[a+r.t]-=r.DV,n[a+r.t+1]=1)}n.t>0&&(n[n.t-1]+=r.am(a,r[a],n,2*a,0,1)),n.s=0,n.clamp()}function yn(n,r,a){var c=n.abs();if(!(c.t<=0)){var f=this.abs();if(f.t<c.t){r?.fromInt(0),a!=null&&this.copyTo(a);return}a==null&&(a=p());var g=p(),x=this.s,M=n.s,b=this.DB-W(c[c.t-1]);b>0?(c.lShiftTo(b,g),f.lShiftTo(b,a)):(c.copyTo(g),f.copyTo(a));var w=g.t,L=g[w-1];if(L!=0){var R=L*(1<<this.F1)+(w>1?g[w-2]>>this.F2:0),F=this.FV/R,G=(1<<this.F1)/R,J=1<<this.F2,$=a.t,et=$-w,xt=r??p();for(g.dlShiftTo(et,xt),a.compareTo(xt)>=0&&(a[a.t++]=1,a.subTo(xt,a)),u.ONE.dlShiftTo(w,xt),xt.subTo(g,g);g.t<w;)g[g.t++]=0;for(;--et>=0;){var Bt=a[--$]==L?this.DM:Math.floor(a[$]*F+(a[$-1]+J)*G);if((a[$]+=g.am(0,Bt,a,et,0,w))<Bt)for(g.dlShiftTo(et,xt),a.subTo(xt,a);a[$]<--Bt;)a.subTo(xt,a)}r!=null&&(a.drShiftTo(w,r),x!=M&&u.ZERO.subTo(r,r)),a.t=w,a.clamp(),b>0&&a.rShiftTo(b,a),x<0&&u.ZERO.subTo(a,a)}}}function vn(n){var r=p();return this.abs().divRemTo(n,null,r),this.s<0&&r.compareTo(u.ZERO)>0&&n.subTo(r,r),r}function Ut(n){this.m=n}function Sn(n){return n.s<0||n.compareTo(this.m)>=0?n.mod(this.m):n}function Mn(n){return n}function bn(n){n.divRemTo(this.m,null,n)}function le(n,r,a){n.multiplyTo(r,a),this.reduce(a)}function ce(n,r){n.squareTo(r),this.reduce(r)}Ut.prototype.convert=Sn,Ut.prototype.revert=Mn,Ut.prototype.reduce=bn,Ut.prototype.mulTo=le,Ut.prototype.sqrTo=ce;function he(){if(this.t<1)return 0;var n=this[0];if((n&1)==0)return 0;var r=n&3;return r=r*(2-(n&15)*r)&15,r=r*(2-(n&255)*r)&255,r=r*(2-((n&65535)*r&65535))&65535,r=r*(2-n*r%this.DV)%this.DV,r>0?this.DV-r:-r}function Rt(n){this.m=n,this.mp=n.invDigit(),this.mpl=this.mp&32767,this.mph=this.mp>>15,this.um=(1<<n.DB-15)-1,this.mt2=2*n.t}function qe(n){var r=p();return n.abs().dlShiftTo(this.m.t,r),r.divRemTo(this.m,null,r),n.s<0&&r.compareTo(u.ZERO)>0&&this.m.subTo(r,r),r}function Zr(n){var r=p();return n.copyTo(r),this.reduce(r),r}function Jr(n){for(;n.t<=this.mt2;)n[n.t++]=0;for(var r=0;r<this.m.t;++r){var a=n[r]&32767,c=a*this.mpl+((a*this.mph+(n[r]>>15)*this.mpl&this.um)<<15)&n.DM;for(a=r+this.m.t,n[a]+=this.m.am(0,c,n,r,0,this.m.t);n[a]>=n.DV;)n[a]-=n.DV,n[++a]++}n.clamp(),n.drShiftTo(this.m.t,n),n.compareTo(this.m)>=0&&n.subTo(this.m,n)}function $r(n,r){n.squareTo(r),this.reduce(r)}function Kr(n,r,a){n.multiplyTo(r,a),this.reduce(a)}Rt.prototype.convert=qe,Rt.prototype.revert=Zr,Rt.prototype.reduce=Jr,Rt.prototype.mulTo=Kr,Rt.prototype.sqrTo=$r;function Qr(){return(this.t>0?this[0]&1:this.s)==0}function jr(n,r){if(n>4294967295||n<1)return u.ONE;var a=p(),c=p(),f=r.convert(this),g=W(n)-1;for(f.copyTo(a);--g>=0;)if(r.sqrTo(a,c),(n&1<<g)>0)r.mulTo(c,f,a);else{var x=a;a=c,c=x}return r.revert(a)}function to(n,r){var a;return n<256||r.isEven()?a=new Ut(r):a=new Rt(r),this.exp(n,a)}u.prototype.copyTo=I,u.prototype.fromInt=D,u.prototype.fromString=z,u.prototype.clamp=O,u.prototype.dlShiftTo=Y,u.prototype.drShiftTo=ct,u.prototype.lShiftTo=ft,u.prototype.rShiftTo=Mt,u.prototype.subTo=Ot,u.prototype.multiplyTo=Ft,u.prototype.squareTo=$t,u.prototype.divRemTo=yn,u.prototype.invDigit=he,u.prototype.isEven=Qr,u.prototype.exp=jr,u.prototype.toString=X,u.prototype.negate=V,u.prototype.abs=H,u.prototype.compareTo=j,u.prototype.bitLength=tt,u.prototype.mod=vn,u.prototype.modPowInt=to,u.ZERO=B(0),u.ONE=B(1);function eo(){var n=p();return this.copyTo(n),n}function no(){if(this.s<0){if(this.t==1)return this[0]-this.DV;if(this.t==0)return-1}else{if(this.t==1)return this[0];if(this.t==0)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]}function io(){return this.t==0?this.s:this[0]<<24>>24}function so(){return this.t==0?this.s:this[0]<<16>>16}function ro(n){return Math.floor(Math.LN2*this.DB/Math.log(n))}function oo(){return this.s<0?-1:this.t<=0||this.t==1&&this[0]<=0?0:1}function ao(n){if(n==null&&(n=10),this.signum()==0||n<2||n>36)return"0";var r=this.chunkSize(n),a=Math.pow(n,r),c=B(a),f=p(),g=p(),x="";for(this.divRemTo(c,f,g);f.signum()>0;)x=(a+g.intValue()).toString(n).substr(1)+x,f.divRemTo(c,f,g);return g.intValue().toString(n)+x}function lo(n,r){this.fromInt(0),r==null&&(r=10);for(var a=this.chunkSize(r),c=Math.pow(r,a),f=!1,g=0,x=0,M=0;M<n.length;++M){var b=C(n,M);if(b<0){n.charAt(M)=="-"&&this.signum()==0&&(f=!0);continue}x=r*x+b,++g>=a&&(this.dMultiply(c),this.dAddOffset(x,0),g=0,x=0)}g>0&&(this.dMultiply(Math.pow(r,g)),this.dAddOffset(x,0)),f&&u.ZERO.subTo(this,this)}function co(n,r,a){if(typeof r=="number")if(n<2)this.fromInt(1);else for(this.fromNumber(n,a),this.testBit(n-1)||this.bitwiseTo(u.ONE.shiftLeft(n-1),Mi,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(r);)this.dAddOffset(2,0),this.bitLength()>n&&this.subTo(u.ONE.shiftLeft(n-1),this);else{var c=new Array,f=n&7;c.length=(n>>3)+1,r.nextBytes(c),f>0?c[0]&=(1<<f)-1:c[0]=0,this.fromString(c,256)}}function ho(){var n=this.t,r=new Array;r[0]=this.s;var a=this.DB-n*this.DB%8,c,f=0;if(n-- >0)for(a<this.DB&&(c=this[n]>>a)!=(this.s&this.DM)>>a&&(r[f++]=c|this.s<<this.DB-a);n>=0;)a<8?(c=(this[n]&(1<<a)-1)<<8-a,c|=this[--n]>>(a+=this.DB-8)):(c=this[n]>>(a-=8)&255,a<=0&&(a+=this.DB,--n)),(c&128)!=0&&(c|=-256),f==0&&(this.s&128)!=(c&128)&&++f,(f>0||c!=this.s)&&(r[f++]=c);return r}function uo(n){return this.compareTo(n)==0}function fo(n){return this.compareTo(n)<0?this:n}function po(n){return this.compareTo(n)>0?this:n}function mo(n,r,a){var c,f,g=Math.min(n.t,this.t);for(c=0;c<g;++c)a[c]=r(this[c],n[c]);if(n.t<this.t){for(f=n.s&this.DM,c=g;c<this.t;++c)a[c]=r(this[c],f);a.t=this.t}else{for(f=this.s&this.DM,c=g;c<n.t;++c)a[c]=r(f,n[c]);a.t=n.t}a.s=r(this.s,n.s),a.clamp()}function go(n,r){return n&r}function _o(n){var r=p();return this.bitwiseTo(n,go,r),r}function Mi(n,r){return n|r}function xo(n){var r=p();return this.bitwiseTo(n,Mi,r),r}function Ns(n,r){return n^r}function yo(n){var r=p();return this.bitwiseTo(n,Ns,r),r}function Ds(n,r){return n&~r}function vo(n){var r=p();return this.bitwiseTo(n,Ds,r),r}function So(){for(var n=p(),r=0;r<this.t;++r)n[r]=this.DM&~this[r];return n.t=this.t,n.s=~this.s,n}function Mo(n){var r=p();return n<0?this.rShiftTo(-n,r):this.lShiftTo(n,r),r}function bo(n){var r=p();return n<0?this.lShiftTo(-n,r):this.rShiftTo(n,r),r}function To(n){if(n==0)return-1;var r=0;return(n&65535)==0&&(n>>=16,r+=16),(n&255)==0&&(n>>=8,r+=8),(n&15)==0&&(n>>=4,r+=4),(n&3)==0&&(n>>=2,r+=2),(n&1)==0&&++r,r}function Eo(){for(var n=0;n<this.t;++n)if(this[n]!=0)return n*this.DB+To(this[n]);return this.s<0?this.t*this.DB:-1}function Ao(n){for(var r=0;n!=0;)n&=n-1,++r;return r}function wo(){for(var n=0,r=this.s&this.DM,a=0;a<this.t;++a)n+=Ao(this[a]^r);return n}function Co(n){var r=Math.floor(n/this.DB);return r>=this.t?this.s!=0:(this[r]&1<<n%this.DB)!=0}function Po(n,r){var a=u.ONE.shiftLeft(n);return this.bitwiseTo(a,r,a),a}function Io(n){return this.changeBit(n,Mi)}function Ro(n){return this.changeBit(n,Ds)}function Lo(n){return this.changeBit(n,Ns)}function No(n,r){for(var a=0,c=0,f=Math.min(n.t,this.t);a<f;)c+=this[a]+n[a],r[a++]=c&this.DM,c>>=this.DB;if(n.t<this.t){for(c+=n.s;a<this.t;)c+=this[a],r[a++]=c&this.DM,c>>=this.DB;c+=this.s}else{for(c+=this.s;a<n.t;)c+=n[a],r[a++]=c&this.DM,c>>=this.DB;c+=n.s}r.s=c<0?-1:0,c>0?r[a++]=c:c<-1&&(r[a++]=this.DV+c),r.t=a,r.clamp()}function Do(n){var r=p();return this.addTo(n,r),r}function Oo(n){var r=p();return this.subTo(n,r),r}function Fo(n){var r=p();return this.multiplyTo(n,r),r}function Uo(){var n=p();return this.squareTo(n),n}function Bo(n){var r=p();return this.divRemTo(n,r,null),r}function zo(n){var r=p();return this.divRemTo(n,null,r),r}function Vo(n){var r=p(),a=p();return this.divRemTo(n,r,a),new Array(r,a)}function ko(n){this[this.t]=this.am(0,n-1,this,0,0,this.t),++this.t,this.clamp()}function Ho(n,r){if(n!=0){for(;this.t<=r;)this[this.t++]=0;for(this[r]+=n;this[r]>=this.DV;)this[r]-=this.DV,++r>=this.t&&(this[this.t++]=0),++this[r]}}function Ze(){}function Os(n){return n}function Go(n,r,a){n.multiplyTo(r,a)}function Xo(n,r){n.squareTo(r)}Ze.prototype.convert=Os,Ze.prototype.revert=Os,Ze.prototype.mulTo=Go,Ze.prototype.sqrTo=Xo;function Wo(n){return this.exp(n,new Ze)}function Yo(n,r,a){var c=Math.min(this.t+n.t,r);for(a.s=0,a.t=c;c>0;)a[--c]=0;var f;for(f=a.t-this.t;c<f;++c)a[c+this.t]=this.am(0,n[c],a,c,0,this.t);for(f=Math.min(n.t,r);c<f;++c)this.am(0,n[c],a,c,0,r-c);a.clamp()}function qo(n,r,a){--r;var c=a.t=this.t+n.t-r;for(a.s=0;--c>=0;)a[c]=0;for(c=Math.max(r-this.t,0);c<n.t;++c)a[this.t+c-r]=this.am(r-c,n[c],a,0,0,this.t+c-r);a.clamp(),a.drShiftTo(1,a)}function Se(n){this.r2=p(),this.q3=p(),u.ONE.dlShiftTo(2*n.t,this.r2),this.mu=this.r2.divide(n),this.m=n}function Zo(n){if(n.s<0||n.t>2*this.m.t)return n.mod(this.m);if(n.compareTo(this.m)<0)return n;var r=p();return n.copyTo(r),this.reduce(r),r}function Jo(n){return n}function $o(n){for(n.drShiftTo(this.m.t-1,this.r2),n.t>this.m.t+1&&(n.t=this.m.t+1,n.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);n.compareTo(this.r2)<0;)n.dAddOffset(1,this.m.t+1);for(n.subTo(this.r2,n);n.compareTo(this.m)>=0;)n.subTo(this.m,n)}function Ko(n,r){n.squareTo(r),this.reduce(r)}function Qo(n,r,a){n.multiplyTo(r,a),this.reduce(a)}Se.prototype.convert=Zo,Se.prototype.revert=Jo,Se.prototype.reduce=$o,Se.prototype.mulTo=Qo,Se.prototype.sqrTo=Ko;function jo(n,r){var a=n.bitLength(),c,f=B(1),g;if(a<=0)return f;a<18?c=1:a<48?c=3:a<144?c=4:a<768?c=5:c=6,a<8?g=new Ut(r):r.isEven()?g=new Se(r):g=new Rt(r);var x=new Array,M=3,b=c-1,w=(1<<c)-1;if(x[1]=g.convert(this),c>1){var L=p();for(g.sqrTo(x[1],L);M<=w;)x[M]=p(),g.mulTo(L,x[M-2],x[M]),M+=2}var R=n.t-1,F,G=!0,J=p(),$;for(a=W(n[R])-1;R>=0;){for(a>=b?F=n[R]>>a-b&w:(F=(n[R]&(1<<a+1)-1)<<b-a,R>0&&(F|=n[R-1]>>this.DB+a-b)),M=c;(F&1)==0;)F>>=1,--M;if((a-=M)<0&&(a+=this.DB,--R),G)x[F].copyTo(f),G=!1;else{for(;M>1;)g.sqrTo(f,J),g.sqrTo(J,f),M-=2;M>0?g.sqrTo(f,J):($=f,f=J,J=$),g.mulTo(J,x[F],f)}for(;R>=0&&(n[R]&1<<a)==0;)g.sqrTo(f,J),$=f,f=J,J=$,--a<0&&(a=this.DB-1,--R)}return g.revert(f)}function ta(n){var r=this.s<0?this.negate():this.clone(),a=n.s<0?n.negate():n.clone();if(r.compareTo(a)<0){var c=r;r=a,a=c}var f=r.getLowestSetBit(),g=a.getLowestSetBit();if(g<0)return r;for(f<g&&(g=f),g>0&&(r.rShiftTo(g,r),a.rShiftTo(g,a));r.signum()>0;)(f=r.getLowestSetBit())>0&&r.rShiftTo(f,r),(f=a.getLowestSetBit())>0&&a.rShiftTo(f,a),r.compareTo(a)>=0?(r.subTo(a,r),r.rShiftTo(1,r)):(a.subTo(r,a),a.rShiftTo(1,a));return g>0&&a.lShiftTo(g,a),a}function ea(n){if(n<=0)return 0;var r=this.DV%n,a=this.s<0?n-1:0;if(this.t>0)if(r==0)a=this[0]%n;else for(var c=this.t-1;c>=0;--c)a=(r*a+this[c])%n;return a}function na(n){var r=n.isEven();if(this.isEven()&&r||n.signum()==0)return u.ZERO;for(var a=n.clone(),c=this.clone(),f=B(1),g=B(0),x=B(0),M=B(1);a.signum()!=0;){for(;a.isEven();)a.rShiftTo(1,a),r?((!f.isEven()||!g.isEven())&&(f.addTo(this,f),g.subTo(n,g)),f.rShiftTo(1,f)):g.isEven()||g.subTo(n,g),g.rShiftTo(1,g);for(;c.isEven();)c.rShiftTo(1,c),r?((!x.isEven()||!M.isEven())&&(x.addTo(this,x),M.subTo(n,M)),x.rShiftTo(1,x)):M.isEven()||M.subTo(n,M),M.rShiftTo(1,M);a.compareTo(c)>=0?(a.subTo(c,a),r&&f.subTo(x,f),g.subTo(M,g)):(c.subTo(a,c),r&&x.subTo(f,x),M.subTo(g,M))}if(c.compareTo(u.ONE)!=0)return u.ZERO;if(M.compareTo(n)>=0)return M.subtract(n);if(M.signum()<0)M.addTo(n,M);else return M;return M.signum()<0?M.add(n):M}var mt=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],ia=(1<<26)/mt[mt.length-1];function sa(n){var r,a=this.abs();if(a.t==1&&a[0]<=mt[mt.length-1]){for(r=0;r<mt.length;++r)if(a[0]==mt[r])return!0;return!1}if(a.isEven())return!1;for(r=1;r<mt.length;){for(var c=mt[r],f=r+1;f<mt.length&&c<ia;)c*=mt[f++];for(c=a.modInt(c);r<f;)if(c%mt[r++]==0)return!1}return a.millerRabin(n)}function ra(n){var r=this.subtract(u.ONE),a=r.getLowestSetBit();if(a<=0)return!1;var c=r.shiftRight(a);n=n+1>>1,n>mt.length&&(n=mt.length);for(var f=p(),g=0;g<n;++g){f.fromInt(mt[Math.floor(Math.random()*mt.length)]);var x=f.modPow(c,this);if(x.compareTo(u.ONE)!=0&&x.compareTo(r)!=0){for(var M=1;M++<a&&x.compareTo(r)!=0;)if(x=x.modPowInt(2,this),x.compareTo(u.ONE)==0)return!1;if(x.compareTo(r)!=0)return!1}}return!0}u.prototype.chunkSize=ro,u.prototype.toRadix=ao,u.prototype.fromRadix=lo,u.prototype.fromNumber=co,u.prototype.bitwiseTo=mo,u.prototype.changeBit=Po,u.prototype.addTo=No,u.prototype.dMultiply=ko,u.prototype.dAddOffset=Ho,u.prototype.multiplyLowerTo=Yo,u.prototype.multiplyUpperTo=qo,u.prototype.modInt=ea,u.prototype.millerRabin=ra,u.prototype.clone=eo,u.prototype.intValue=no,u.prototype.byteValue=io,u.prototype.shortValue=so,u.prototype.signum=oo,u.prototype.toByteArray=ho,u.prototype.equals=uo,u.prototype.min=fo,u.prototype.max=po,u.prototype.and=_o,u.prototype.or=xo,u.prototype.xor=yo,u.prototype.andNot=vo,u.prototype.not=So,u.prototype.shiftLeft=Mo,u.prototype.shiftRight=bo,u.prototype.getLowestSetBit=Eo,u.prototype.bitCount=wo,u.prototype.testBit=Co,u.prototype.setBit=Io,u.prototype.clearBit=Ro,u.prototype.flipBit=Lo,u.prototype.add=Do,u.prototype.subtract=Oo,u.prototype.multiply=Fo,u.prototype.divide=Bo,u.prototype.remainder=zo,u.prototype.divideAndRemainder=Vo,u.prototype.modPow=jo,u.prototype.modInverse=na,u.prototype.pow=Wo,u.prototype.gcd=ta,u.prototype.isProbablePrime=sa,u.prototype.square=Uo;var Z=u;Z.prototype.IsNegative=function(){return this.compareTo(Z.ZERO)==-1},Z.op_Equality=function(n,r){return n.compareTo(r)==0},Z.op_Inequality=function(n,r){return n.compareTo(r)!=0},Z.op_GreaterThan=function(n,r){return n.compareTo(r)>0},Z.op_LessThan=function(n,r){return n.compareTo(r)<0},Z.op_Addition=function(n,r){return new Z(n,void 0,void 0).add(new Z(r,void 0,void 0))},Z.op_Subtraction=function(n,r){return new Z(n,void 0,void 0).subtract(new Z(r,void 0,void 0))},Z.Int128Mul=function(n,r){return new Z(n,void 0,void 0).multiply(new Z(r,void 0,void 0))},Z.op_Division=function(n,r){return n.divide(r)},Z.prototype.ToDouble=function(){return parseFloat(this.toString())};var Fs=function(n,r){var a;if(typeof Object.getOwnPropertyNames>"u"){for(a in r.prototype)(typeof n.prototype[a]>"u"||n.prototype[a]===Object.prototype[a])&&(n.prototype[a]=r.prototype[a]);for(a in r)typeof n[a]>"u"&&(n[a]=r[a]);n.$baseCtor=r}else{for(var c=Object.getOwnPropertyNames(r.prototype),f=0;f<c.length;f++)typeof Object.getOwnPropertyDescriptor(n.prototype,c[f])>"u"&&Object.defineProperty(n.prototype,c[f],Object.getOwnPropertyDescriptor(r.prototype,c[f]));for(a in r)typeof n[a]>"u"&&(n[a]=r[a]);n.$baseCtor=r}};i.Path=function(){return[]},i.Path.prototype.push=Array.prototype.push,i.Paths=function(){return[]},i.Paths.prototype.push=Array.prototype.push,i.DoublePoint=function(){var n=arguments;this.X=0,this.Y=0,n.length===1?(this.X=n[0].X,this.Y=n[0].Y):n.length===2&&(this.X=n[0],this.Y=n[1])},i.DoublePoint0=function(){this.X=0,this.Y=0},i.DoublePoint0.prototype=i.DoublePoint.prototype,i.DoublePoint1=function(n){this.X=n.X,this.Y=n.Y},i.DoublePoint1.prototype=i.DoublePoint.prototype,i.DoublePoint2=function(n,r){this.X=n,this.Y=r},i.DoublePoint2.prototype=i.DoublePoint.prototype,i.PolyNode=function(){this.m_Parent=null,this.m_polygon=new i.Path,this.m_Index=0,this.m_jointype=0,this.m_endtype=0,this.m_Childs=[],this.IsOpen=!1},i.PolyNode.prototype.IsHoleNode=function(){for(var n=!0,r=this.m_Parent;r!==null;)n=!n,r=r.m_Parent;return n},i.PolyNode.prototype.ChildCount=function(){return this.m_Childs.length},i.PolyNode.prototype.Contour=function(){return this.m_polygon},i.PolyNode.prototype.AddChild=function(n){var r=this.m_Childs.length;this.m_Childs.push(n),n.m_Parent=this,n.m_Index=r},i.PolyNode.prototype.GetNext=function(){return this.m_Childs.length>0?this.m_Childs[0]:this.GetNextSiblingUp()},i.PolyNode.prototype.GetNextSiblingUp=function(){return this.m_Parent===null?null:this.m_Index===this.m_Parent.m_Childs.length-1?this.m_Parent.GetNextSiblingUp():this.m_Parent.m_Childs[this.m_Index+1]},i.PolyNode.prototype.Childs=function(){return this.m_Childs},i.PolyNode.prototype.Parent=function(){return this.m_Parent},i.PolyNode.prototype.IsHole=function(){return this.IsHoleNode()},i.PolyTree=function(){this.m_AllPolys=[],i.PolyNode.call(this)},i.PolyTree.prototype.Clear=function(){for(var n=0,r=this.m_AllPolys.length;n<r;n++)this.m_AllPolys[n]=null;this.m_AllPolys.length=0,this.m_Childs.length=0},i.PolyTree.prototype.GetFirst=function(){return this.m_Childs.length>0?this.m_Childs[0]:null},i.PolyTree.prototype.Total=function(){var n=this.m_AllPolys.length;return n>0&&this.m_Childs[0]!==this.m_AllPolys[0]&&n--,n},Fs(i.PolyTree,i.PolyNode),i.Math_Abs_Int64=i.Math_Abs_Int32=i.Math_Abs_Double=function(n){return Math.abs(n)},i.Math_Max_Int32_Int32=function(n,r){return Math.max(n,r)},o.msie||o.opera||o.safari?i.Cast_Int32=function(n){return n|0}:i.Cast_Int32=function(n){return~~n},typeof Number.toInteger>"u"&&(Number.toInteger=null),o.chrome?i.Cast_Int64=function(n){return n<-2147483648||n>2147483647?n<0?Math.ceil(n):Math.floor(n):~~n}:o.firefox&&typeof Number.toInteger=="function"?i.Cast_Int64=function(n){return Number.toInteger(n)}:o.msie7||o.msie8?i.Cast_Int64=function(n){return parseInt(n,10)}:o.msie?i.Cast_Int64=function(n){return n<-2147483648||n>2147483647?n<0?Math.ceil(n):Math.floor(n):n|0}:i.Cast_Int64=function(n){return n<0?Math.ceil(n):Math.floor(n)},i.Clear=function(n){n.length=0},i.PI=3.141592653589793,i.PI2=2*3.141592653589793,i.IntPoint=function(){var n=arguments,r=n.length;if(this.X=0,this.Y=0,i.use_xyz)if(this.Z=0,r===3)this.X=n[0],this.Y=n[1],this.Z=n[2];else if(r===2)this.X=n[0],this.Y=n[1],this.Z=0;else if(r===1)if(n[0]instanceof i.DoublePoint){var a=n[0];this.X=i.Clipper.Round(a.X),this.Y=i.Clipper.Round(a.Y),this.Z=0}else{var c=n[0];typeof c.Z>"u"&&(c.Z=0),this.X=c.X,this.Y=c.Y,this.Z=c.Z}else this.X=0,this.Y=0,this.Z=0;else if(r===2)this.X=n[0],this.Y=n[1];else if(r===1)if(n[0]instanceof i.DoublePoint){var a=n[0];this.X=i.Clipper.Round(a.X),this.Y=i.Clipper.Round(a.Y)}else{var c=n[0];this.X=c.X,this.Y=c.Y}else this.X=0,this.Y=0},i.IntPoint.op_Equality=function(n,r){return n.X===r.X&&n.Y===r.Y},i.IntPoint.op_Inequality=function(n,r){return n.X!==r.X||n.Y!==r.Y},i.IntPoint0=function(){this.X=0,this.Y=0,i.use_xyz&&(this.Z=0)},i.IntPoint0.prototype=i.IntPoint.prototype,i.IntPoint1=function(n){this.X=n.X,this.Y=n.Y,i.use_xyz&&(typeof n.Z>"u"?this.Z=0:this.Z=n.Z)},i.IntPoint1.prototype=i.IntPoint.prototype,i.IntPoint1dp=function(n){this.X=i.Clipper.Round(n.X),this.Y=i.Clipper.Round(n.Y),i.use_xyz&&(this.Z=0)},i.IntPoint1dp.prototype=i.IntPoint.prototype,i.IntPoint2=function(n,r,a){this.X=n,this.Y=r,i.use_xyz&&(typeof a>"u"?this.Z=0:this.Z=a)},i.IntPoint2.prototype=i.IntPoint.prototype,i.IntRect=function(){var n=arguments,r=n.length;if(r===4)this.left=n[0],this.top=n[1],this.right=n[2],this.bottom=n[3];else if(r===1){var a=n[0];this.left=a.left,this.top=a.top,this.right=a.right,this.bottom=a.bottom}else this.left=0,this.top=0,this.right=0,this.bottom=0},i.IntRect0=function(){this.left=0,this.top=0,this.right=0,this.bottom=0},i.IntRect0.prototype=i.IntRect.prototype,i.IntRect1=function(n){this.left=n.left,this.top=n.top,this.right=n.right,this.bottom=n.bottom},i.IntRect1.prototype=i.IntRect.prototype,i.IntRect4=function(n,r,a,c){this.left=n,this.top=r,this.right=a,this.bottom=c},i.IntRect4.prototype=i.IntRect.prototype,i.ClipType={ctIntersection:0,ctUnion:1,ctDifference:2,ctXor:3},i.PolyType={ptSubject:0,ptClip:1},i.PolyFillType={pftEvenOdd:0,pftNonZero:1,pftPositive:2,pftNegative:3},i.JoinType={jtSquare:0,jtRound:1,jtMiter:2},i.EndType={etOpenSquare:0,etOpenRound:1,etOpenButt:2,etClosedLine:3,etClosedPolygon:4},i.EdgeSide={esLeft:0,esRight:1},i.Direction={dRightToLeft:0,dLeftToRight:1},i.TEdge=function(){this.Bot=new i.IntPoint0,this.Curr=new i.IntPoint0,this.Top=new i.IntPoint0,this.Delta=new i.IntPoint0,this.Dx=0,this.PolyTyp=i.PolyType.ptSubject,this.Side=i.EdgeSide.esLeft,this.WindDelta=0,this.WindCnt=0,this.WindCnt2=0,this.OutIdx=0,this.Next=null,this.Prev=null,this.NextInLML=null,this.NextInAEL=null,this.PrevInAEL=null,this.NextInSEL=null,this.PrevInSEL=null},i.IntersectNode=function(){this.Edge1=null,this.Edge2=null,this.Pt=new i.IntPoint0},i.MyIntersectNodeSort=function(){},i.MyIntersectNodeSort.Compare=function(n,r){var a=r.Pt.Y-n.Pt.Y;return a>0?1:a<0?-1:0},i.LocalMinima=function(){this.Y=0,this.LeftBound=null,this.RightBound=null,this.Next=null},i.Scanbeam=function(){this.Y=0,this.Next=null},i.Maxima=function(){this.X=0,this.Next=null,this.Prev=null},i.OutRec=function(){this.Idx=0,this.IsHole=!1,this.IsOpen=!1,this.FirstLeft=null,this.Pts=null,this.BottomPt=null,this.PolyNode=null},i.OutPt=function(){this.Idx=0,this.Pt=new i.IntPoint0,this.Next=null,this.Prev=null},i.Join=function(){this.OutPt1=null,this.OutPt2=null,this.OffPt=new i.IntPoint0},i.ClipperBase=function(){this.m_MinimaList=null,this.m_CurrentLM=null,this.m_edges=new Array,this.m_UseFullRange=!1,this.m_HasOpenPaths=!1,this.PreserveCollinear=!1,this.m_Scanbeam=null,this.m_PolyOuts=null,this.m_ActiveEdges=null},i.ClipperBase.horizontal=-9007199254740992,i.ClipperBase.Skip=-2,i.ClipperBase.Unassigned=-1,i.ClipperBase.tolerance=1e-20,i.ClipperBase.loRange=47453132,i.ClipperBase.hiRange=0xfffffffffffff,i.ClipperBase.near_zero=function(n){return n>-i.ClipperBase.tolerance&&n<i.ClipperBase.tolerance},i.ClipperBase.IsHorizontal=function(n){return n.Delta.Y===0},i.ClipperBase.prototype.PointIsVertex=function(n,r){var a=r;do{if(i.IntPoint.op_Equality(a.Pt,n))return!0;a=a.Next}while(a!==r);return!1},i.ClipperBase.prototype.PointOnLineSegment=function(n,r,a,c){return c?n.X===r.X&&n.Y===r.Y||n.X===a.X&&n.Y===a.Y||n.X>r.X==n.X<a.X&&n.Y>r.Y==n.Y<a.Y&&Z.op_Equality(Z.Int128Mul(n.X-r.X,a.Y-r.Y),Z.Int128Mul(a.X-r.X,n.Y-r.Y)):n.X===r.X&&n.Y===r.Y||n.X===a.X&&n.Y===a.Y||n.X>r.X==n.X<a.X&&n.Y>r.Y==n.Y<a.Y&&(n.X-r.X)*(a.Y-r.Y)===(a.X-r.X)*(n.Y-r.Y)},i.ClipperBase.prototype.PointOnPolygon=function(n,r,a){for(var c=r;;){if(this.PointOnLineSegment(n,c.Pt,c.Next.Pt,a))return!0;if(c=c.Next,c===r)break}return!1},i.ClipperBase.prototype.SlopesEqual=i.ClipperBase.SlopesEqual=function(){var n=arguments,r=n.length,a,c,f,g,x,M,b;return r===3?(a=n[0],c=n[1],b=n[2],b?Z.op_Equality(Z.Int128Mul(a.Delta.Y,c.Delta.X),Z.Int128Mul(a.Delta.X,c.Delta.Y)):i.Cast_Int64(a.Delta.Y*c.Delta.X)===i.Cast_Int64(a.Delta.X*c.Delta.Y)):r===4?(f=n[0],g=n[1],x=n[2],b=n[3],b?Z.op_Equality(Z.Int128Mul(f.Y-g.Y,g.X-x.X),Z.Int128Mul(f.X-g.X,g.Y-x.Y)):i.Cast_Int64((f.Y-g.Y)*(g.X-x.X))-i.Cast_Int64((f.X-g.X)*(g.Y-x.Y))===0):(f=n[0],g=n[1],x=n[2],M=n[3],b=n[4],b?Z.op_Equality(Z.Int128Mul(f.Y-g.Y,x.X-M.X),Z.Int128Mul(f.X-g.X,x.Y-M.Y)):i.Cast_Int64((f.Y-g.Y)*(x.X-M.X))-i.Cast_Int64((f.X-g.X)*(x.Y-M.Y))===0)},i.ClipperBase.SlopesEqual3=function(n,r,a){return a?Z.op_Equality(Z.Int128Mul(n.Delta.Y,r.Delta.X),Z.Int128Mul(n.Delta.X,r.Delta.Y)):i.Cast_Int64(n.Delta.Y*r.Delta.X)===i.Cast_Int64(n.Delta.X*r.Delta.Y)},i.ClipperBase.SlopesEqual4=function(n,r,a,c){return c?Z.op_Equality(Z.Int128Mul(n.Y-r.Y,r.X-a.X),Z.Int128Mul(n.X-r.X,r.Y-a.Y)):i.Cast_Int64((n.Y-r.Y)*(r.X-a.X))-i.Cast_Int64((n.X-r.X)*(r.Y-a.Y))===0},i.ClipperBase.SlopesEqual5=function(n,r,a,c,f){return f?Z.op_Equality(Z.Int128Mul(n.Y-r.Y,a.X-c.X),Z.Int128Mul(n.X-r.X,a.Y-c.Y)):i.Cast_Int64((n.Y-r.Y)*(a.X-c.X))-i.Cast_Int64((n.X-r.X)*(a.Y-c.Y))===0},i.ClipperBase.prototype.Clear=function(){this.DisposeLocalMinimaList();for(var n=0,r=this.m_edges.length;n<r;++n){for(var a=0,c=this.m_edges[n].length;a<c;++a)this.m_edges[n][a]=null;i.Clear(this.m_edges[n])}i.Clear(this.m_edges),this.m_UseFullRange=!1,this.m_HasOpenPaths=!1},i.ClipperBase.prototype.DisposeLocalMinimaList=function(){for(;this.m_MinimaList!==null;){var n=this.m_MinimaList.Next;this.m_MinimaList=null,this.m_MinimaList=n}this.m_CurrentLM=null},i.ClipperBase.prototype.RangeTest=function(n,r){r.Value?(n.X>i.ClipperBase.hiRange||n.Y>i.ClipperBase.hiRange||-n.X>i.ClipperBase.hiRange||-n.Y>i.ClipperBase.hiRange)&&i.Error("Coordinate outside allowed range in RangeTest()."):(n.X>i.ClipperBase.loRange||n.Y>i.ClipperBase.loRange||-n.X>i.ClipperBase.loRange||-n.Y>i.ClipperBase.loRange)&&(r.Value=!0,this.RangeTest(n,r))},i.ClipperBase.prototype.InitEdge=function(n,r,a,c){n.Next=r,n.Prev=a,n.Curr.X=c.X,n.Curr.Y=c.Y,i.use_xyz&&(n.Curr.Z=c.Z),n.OutIdx=-1},i.ClipperBase.prototype.InitEdge2=function(n,r){n.Curr.Y>=n.Next.Curr.Y?(n.Bot.X=n.Curr.X,n.Bot.Y=n.Curr.Y,i.use_xyz&&(n.Bot.Z=n.Curr.Z),n.Top.X=n.Next.Curr.X,n.Top.Y=n.Next.Curr.Y,i.use_xyz&&(n.Top.Z=n.Next.Curr.Z)):(n.Top.X=n.Curr.X,n.Top.Y=n.Curr.Y,i.use_xyz&&(n.Top.Z=n.Curr.Z),n.Bot.X=n.Next.Curr.X,n.Bot.Y=n.Next.Curr.Y,i.use_xyz&&(n.Bot.Z=n.Next.Curr.Z)),this.SetDx(n),n.PolyTyp=r},i.ClipperBase.prototype.FindNextLocMin=function(n){for(var r;;){for(;i.IntPoint.op_Inequality(n.Bot,n.Prev.Bot)||i.IntPoint.op_Equality(n.Curr,n.Top);)n=n.Next;if(n.Dx!==i.ClipperBase.horizontal&&n.Prev.Dx!==i.ClipperBase.horizontal)break;for(;n.Prev.Dx===i.ClipperBase.horizontal;)n=n.Prev;for(r=n;n.Dx===i.ClipperBase.horizontal;)n=n.Next;if(n.Top.Y!==n.Prev.Bot.Y){r.Prev.Bot.X<n.Bot.X&&(n=r);break}}return n},i.ClipperBase.prototype.ProcessBound=function(n,r){var a,c=n,f;if(c.OutIdx===i.ClipperBase.Skip){if(n=c,r){for(;n.Top.Y===n.Next.Bot.Y;)n=n.Next;for(;n!==c&&n.Dx===i.ClipperBase.horizontal;)n=n.Prev}else{for(;n.Top.Y===n.Prev.Bot.Y;)n=n.Prev;for(;n!==c&&n.Dx===i.ClipperBase.horizontal;)n=n.Next}if(n===c)r?c=n.Next:c=n.Prev;else{r?n=c.Next:n=c.Prev;var g=new i.LocalMinima;g.Next=null,g.Y=n.Bot.Y,g.LeftBound=null,g.RightBound=n,n.WindDelta=0,c=this.ProcessBound(n,r),this.InsertLocalMinima(g)}return c}if(n.Dx===i.ClipperBase.horizontal&&(r?a=n.Prev:a=n.Next,a.Dx===i.ClipperBase.horizontal?a.Bot.X!==n.Bot.X&&a.Top.X!==n.Bot.X&&this.ReverseHorizontal(n):a.Bot.X!==n.Bot.X&&this.ReverseHorizontal(n)),a=n,r){for(;c.Top.Y===c.Next.Bot.Y&&c.Next.OutIdx!==i.ClipperBase.Skip;)c=c.Next;if(c.Dx===i.ClipperBase.horizontal&&c.Next.OutIdx!==i.ClipperBase.Skip){for(f=c;f.Prev.Dx===i.ClipperBase.horizontal;)f=f.Prev;f.Prev.Top.X>c.Next.Top.X&&(c=f.Prev)}for(;n!==c;)n.NextInLML=n.Next,n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Prev.Top.X&&this.ReverseHorizontal(n),n=n.Next;n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Prev.Top.X&&this.ReverseHorizontal(n),c=c.Next}else{for(;c.Top.Y===c.Prev.Bot.Y&&c.Prev.OutIdx!==i.ClipperBase.Skip;)c=c.Prev;if(c.Dx===i.ClipperBase.horizontal&&c.Prev.OutIdx!==i.ClipperBase.Skip){for(f=c;f.Next.Dx===i.ClipperBase.horizontal;)f=f.Next;(f.Next.Top.X===c.Prev.Top.X||f.Next.Top.X>c.Prev.Top.X)&&(c=f.Next)}for(;n!==c;)n.NextInLML=n.Prev,n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Next.Top.X&&this.ReverseHorizontal(n),n=n.Prev;n.Dx===i.ClipperBase.horizontal&&n!==a&&n.Bot.X!==n.Next.Top.X&&this.ReverseHorizontal(n),c=c.Prev}return c},i.ClipperBase.prototype.AddPath=function(n,r,a){i.use_lines?!a&&r===i.PolyType.ptClip&&i.Error("AddPath: Open paths must be subject."):a||i.Error("AddPath: Open paths have been disabled.");var c=n.length-1;if(a)for(;c>0&&i.IntPoint.op_Equality(n[c],n[0]);)--c;for(;c>0&&i.IntPoint.op_Equality(n[c],n[c-1]);)--c;if(a&&c<2||!a&&c<1)return!1;for(var f=new Array,g=0;g<=c;g++)f.push(new i.TEdge);var x=!0;f[1].Curr.X=n[1].X,f[1].Curr.Y=n[1].Y,i.use_xyz&&(f[1].Curr.Z=n[1].Z);var M={Value:this.m_UseFullRange};this.RangeTest(n[0],M),this.m_UseFullRange=M.Value,M.Value=this.m_UseFullRange,this.RangeTest(n[c],M),this.m_UseFullRange=M.Value,this.InitEdge(f[0],f[1],f[c],n[0]),this.InitEdge(f[c],f[0],f[c-1],n[c]);for(var g=c-1;g>=1;--g)M.Value=this.m_UseFullRange,this.RangeTest(n[g],M),this.m_UseFullRange=M.Value,this.InitEdge(f[g],f[g+1],f[g-1],n[g]);for(var b=f[0],w=b,L=b;;){if(w.Curr===w.Next.Curr&&(a||w.Next!==b)){if(w===w.Next)break;w===b&&(b=w.Next),w=this.RemoveEdge(w),L=w;continue}if(w.Prev===w.Next)break;if(a&&i.ClipperBase.SlopesEqual4(w.Prev.Curr,w.Curr,w.Next.Curr,this.m_UseFullRange)&&(!this.PreserveCollinear||!this.Pt2IsBetweenPt1AndPt3(w.Prev.Curr,w.Curr,w.Next.Curr))){w===b&&(b=w.Next),w=this.RemoveEdge(w),w=w.Prev,L=w;continue}if(w=w.Next,w===L||!a&&w.Next===b)break}if(!a&&w===w.Next||a&&w.Prev===w.Next)return!1;a||(this.m_HasOpenPaths=!0,b.Prev.OutIdx=i.ClipperBase.Skip),w=b;do this.InitEdge2(w,r),w=w.Next,x&&w.Curr.Y!==b.Curr.Y&&(x=!1);while(w!==b);if(x){if(a)return!1;w.Prev.OutIdx=i.ClipperBase.Skip;var R=new i.LocalMinima;for(R.Next=null,R.Y=w.Bot.Y,R.LeftBound=null,R.RightBound=w,R.RightBound.Side=i.EdgeSide.esRight,R.RightBound.WindDelta=0;w.Bot.X!==w.Prev.Top.X&&this.ReverseHorizontal(w),w.Next.OutIdx!==i.ClipperBase.Skip;)w.NextInLML=w.Next,w=w.Next;return this.InsertLocalMinima(R),this.m_edges.push(f),!0}this.m_edges.push(f);var F,G=null;for(i.IntPoint.op_Equality(w.Prev.Bot,w.Prev.Top)&&(w=w.Next);w=this.FindNextLocMin(w),w!==G;){G===null&&(G=w);var R=new i.LocalMinima;R.Next=null,R.Y=w.Bot.Y,w.Dx<w.Prev.Dx?(R.LeftBound=w.Prev,R.RightBound=w,F=!1):(R.LeftBound=w,R.RightBound=w.Prev,F=!0),R.LeftBound.Side=i.EdgeSide.esLeft,R.RightBound.Side=i.EdgeSide.esRight,a?R.LeftBound.Next===R.RightBound?R.LeftBound.WindDelta=-1:R.LeftBound.WindDelta=1:R.LeftBound.WindDelta=0,R.RightBound.WindDelta=-R.LeftBound.WindDelta,w=this.ProcessBound(R.LeftBound,F),w.OutIdx===i.ClipperBase.Skip&&(w=this.ProcessBound(w,F));var J=this.ProcessBound(R.RightBound,!F);J.OutIdx===i.ClipperBase.Skip&&(J=this.ProcessBound(J,!F)),R.LeftBound.OutIdx===i.ClipperBase.Skip?R.LeftBound=null:R.RightBound.OutIdx===i.ClipperBase.Skip&&(R.RightBound=null),this.InsertLocalMinima(R),F||(w=J)}return!0},i.ClipperBase.prototype.AddPaths=function(n,r,a){for(var c=!1,f=0,g=n.length;f<g;++f)this.AddPath(n[f],r,a)&&(c=!0);return c},i.ClipperBase.prototype.Pt2IsBetweenPt1AndPt3=function(n,r,a){return i.IntPoint.op_Equality(n,a)||i.IntPoint.op_Equality(n,r)||i.IntPoint.op_Equality(a,r)?!1:n.X!==a.X?r.X>n.X==r.X<a.X:r.Y>n.Y==r.Y<a.Y},i.ClipperBase.prototype.RemoveEdge=function(n){n.Prev.Next=n.Next,n.Next.Prev=n.Prev;var r=n.Next;return n.Prev=null,r},i.ClipperBase.prototype.SetDx=function(n){n.Delta.X=n.Top.X-n.Bot.X,n.Delta.Y=n.Top.Y-n.Bot.Y,n.Delta.Y===0?n.Dx=i.ClipperBase.horizontal:n.Dx=n.Delta.X/n.Delta.Y},i.ClipperBase.prototype.InsertLocalMinima=function(n){if(this.m_MinimaList===null)this.m_MinimaList=n;else if(n.Y>=this.m_MinimaList.Y)n.Next=this.m_MinimaList,this.m_MinimaList=n;else{for(var r=this.m_MinimaList;r.Next!==null&&n.Y<r.Next.Y;)r=r.Next;n.Next=r.Next,r.Next=n}},i.ClipperBase.prototype.PopLocalMinima=function(n,r){return r.v=this.m_CurrentLM,this.m_CurrentLM!==null&&this.m_CurrentLM.Y===n?(this.m_CurrentLM=this.m_CurrentLM.Next,!0):!1},i.ClipperBase.prototype.ReverseHorizontal=function(n){var r=n.Top.X;n.Top.X=n.Bot.X,n.Bot.X=r,i.use_xyz&&(r=n.Top.Z,n.Top.Z=n.Bot.Z,n.Bot.Z=r)},i.ClipperBase.prototype.Reset=function(){if(this.m_CurrentLM=this.m_MinimaList,this.m_CurrentLM!==null){this.m_Scanbeam=null;for(var n=this.m_MinimaList;n!==null;){this.InsertScanbeam(n.Y);var r=n.LeftBound;r!==null&&(r.Curr.X=r.Bot.X,r.Curr.Y=r.Bot.Y,i.use_xyz&&(r.Curr.Z=r.Bot.Z),r.OutIdx=i.ClipperBase.Unassigned),r=n.RightBound,r!==null&&(r.Curr.X=r.Bot.X,r.Curr.Y=r.Bot.Y,i.use_xyz&&(r.Curr.Z=r.Bot.Z),r.OutIdx=i.ClipperBase.Unassigned),n=n.Next}this.m_ActiveEdges=null}},i.ClipperBase.prototype.InsertScanbeam=function(n){if(this.m_Scanbeam===null)this.m_Scanbeam=new i.Scanbeam,this.m_Scanbeam.Next=null,this.m_Scanbeam.Y=n;else if(n>this.m_Scanbeam.Y){var r=new i.Scanbeam;r.Y=n,r.Next=this.m_Scanbeam,this.m_Scanbeam=r}else{for(var a=this.m_Scanbeam;a.Next!==null&&n<=a.Next.Y;)a=a.Next;if(n===a.Y)return;var c=new i.Scanbeam;c.Y=n,c.Next=a.Next,a.Next=c}},i.ClipperBase.prototype.PopScanbeam=function(n){return this.m_Scanbeam===null?(n.v=0,!1):(n.v=this.m_Scanbeam.Y,this.m_Scanbeam=this.m_Scanbeam.Next,!0)},i.ClipperBase.prototype.LocalMinimaPending=function(){return this.m_CurrentLM!==null},i.ClipperBase.prototype.CreateOutRec=function(){var n=new i.OutRec;return n.Idx=i.ClipperBase.Unassigned,n.IsHole=!1,n.IsOpen=!1,n.FirstLeft=null,n.Pts=null,n.BottomPt=null,n.PolyNode=null,this.m_PolyOuts.push(n),n.Idx=this.m_PolyOuts.length-1,n},i.ClipperBase.prototype.DisposeOutRec=function(n){var r=this.m_PolyOuts[n];r.Pts=null,r=null,this.m_PolyOuts[n]=null},i.ClipperBase.prototype.UpdateEdgeIntoAEL=function(n){n.NextInLML===null&&i.Error("UpdateEdgeIntoAEL: invalid call");var r=n.PrevInAEL,a=n.NextInAEL;return n.NextInLML.OutIdx=n.OutIdx,r!==null?r.NextInAEL=n.NextInLML:this.m_ActiveEdges=n.NextInLML,a!==null&&(a.PrevInAEL=n.NextInLML),n.NextInLML.Side=n.Side,n.NextInLML.WindDelta=n.WindDelta,n.NextInLML.WindCnt=n.WindCnt,n.NextInLML.WindCnt2=n.WindCnt2,n=n.NextInLML,n.Curr.X=n.Bot.X,n.Curr.Y=n.Bot.Y,n.PrevInAEL=r,n.NextInAEL=a,i.ClipperBase.IsHorizontal(n)||this.InsertScanbeam(n.Top.Y),n},i.ClipperBase.prototype.SwapPositionsInAEL=function(n,r){if(!(n.NextInAEL===n.PrevInAEL||r.NextInAEL===r.PrevInAEL)){if(n.NextInAEL===r){var a=r.NextInAEL;a!==null&&(a.PrevInAEL=n);var c=n.PrevInAEL;c!==null&&(c.NextInAEL=r),r.PrevInAEL=c,r.NextInAEL=n,n.PrevInAEL=r,n.NextInAEL=a}else if(r.NextInAEL===n){var f=n.NextInAEL;f!==null&&(f.PrevInAEL=r);var g=r.PrevInAEL;g!==null&&(g.NextInAEL=n),n.PrevInAEL=g,n.NextInAEL=r,r.PrevInAEL=n,r.NextInAEL=f}else{var x=n.NextInAEL,M=n.PrevInAEL;n.NextInAEL=r.NextInAEL,n.NextInAEL!==null&&(n.NextInAEL.PrevInAEL=n),n.PrevInAEL=r.PrevInAEL,n.PrevInAEL!==null&&(n.PrevInAEL.NextInAEL=n),r.NextInAEL=x,r.NextInAEL!==null&&(r.NextInAEL.PrevInAEL=r),r.PrevInAEL=M,r.PrevInAEL!==null&&(r.PrevInAEL.NextInAEL=r)}n.PrevInAEL===null?this.m_ActiveEdges=n:r.PrevInAEL===null&&(this.m_ActiveEdges=r)}},i.ClipperBase.prototype.DeleteFromAEL=function(n){var r=n.PrevInAEL,a=n.NextInAEL;r===null&&a===null&&n!==this.m_ActiveEdges||(r!==null?r.NextInAEL=a:this.m_ActiveEdges=a,a!==null&&(a.PrevInAEL=r),n.NextInAEL=null,n.PrevInAEL=null)},i.Clipper=function(n){typeof n>"u"&&(n=0),this.m_PolyOuts=null,this.m_ClipType=i.ClipType.ctIntersection,this.m_Scanbeam=null,this.m_Maxima=null,this.m_ActiveEdges=null,this.m_SortedEdges=null,this.m_IntersectList=null,this.m_IntersectNodeComparer=null,this.m_ExecuteLocked=!1,this.m_ClipFillType=i.PolyFillType.pftEvenOdd,this.m_SubjFillType=i.PolyFillType.pftEvenOdd,this.m_Joins=null,this.m_GhostJoins=null,this.m_UsingPolyTree=!1,this.ReverseSolution=!1,this.StrictlySimple=!1,i.ClipperBase.call(this),this.m_Scanbeam=null,this.m_Maxima=null,this.m_ActiveEdges=null,this.m_SortedEdges=null,this.m_IntersectList=new Array,this.m_IntersectNodeComparer=i.MyIntersectNodeSort.Compare,this.m_ExecuteLocked=!1,this.m_UsingPolyTree=!1,this.m_PolyOuts=new Array,this.m_Joins=new Array,this.m_GhostJoins=new Array,this.ReverseSolution=(1&n)!==0,this.StrictlySimple=(2&n)!==0,this.PreserveCollinear=(4&n)!==0,i.use_xyz&&(this.ZFillFunction=null)},i.Clipper.ioReverseSolution=1,i.Clipper.ioStrictlySimple=2,i.Clipper.ioPreserveCollinear=4,i.Clipper.prototype.Clear=function(){this.m_edges.length!==0&&(this.DisposeAllPolyPts(),i.ClipperBase.prototype.Clear.call(this))},i.Clipper.prototype.InsertMaxima=function(n){var r=new i.Maxima;if(r.X=n,this.m_Maxima===null)this.m_Maxima=r,this.m_Maxima.Next=null,this.m_Maxima.Prev=null;else if(n<this.m_Maxima.X)r.Next=this.m_Maxima,r.Prev=null,this.m_Maxima=r;else{for(var a=this.m_Maxima;a.Next!==null&&n>=a.Next.X;)a=a.Next;if(n===a.X)return;r.Next=a.Next,r.Prev=a,a.Next!==null&&(a.Next.Prev=r),a.Next=r}},i.Clipper.prototype.Execute=function(){var n=arguments,r=n.length,a=n[1]instanceof i.PolyTree;if(r===4&&!a){var c=n[0],f=n[1],g=n[2],x=n[3];if(this.m_ExecuteLocked)return!1;this.m_HasOpenPaths&&i.Error("Error: PolyTree struct is needed for open path clipping."),this.m_ExecuteLocked=!0,i.Clear(f),this.m_SubjFillType=g,this.m_ClipFillType=x,this.m_ClipType=c,this.m_UsingPolyTree=!1;try{var M=this.ExecuteInternal();M&&this.BuildResult(f)}finally{this.DisposeAllPolyPts(),this.m_ExecuteLocked=!1}return M}else if(r===4&&a){var c=n[0],b=n[1],g=n[2],x=n[3];if(this.m_ExecuteLocked)return!1;this.m_ExecuteLocked=!0,this.m_SubjFillType=g,this.m_ClipFillType=x,this.m_ClipType=c,this.m_UsingPolyTree=!0;try{var M=this.ExecuteInternal();M&&this.BuildResult2(b)}finally{this.DisposeAllPolyPts(),this.m_ExecuteLocked=!1}return M}else if(r===2&&!a){var c=n[0],f=n[1];return this.Execute(c,f,i.PolyFillType.pftEvenOdd,i.PolyFillType.pftEvenOdd)}else if(r===2&&a){var c=n[0],b=n[1];return this.Execute(c,b,i.PolyFillType.pftEvenOdd,i.PolyFillType.pftEvenOdd)}},i.Clipper.prototype.FixHoleLinkage=function(n){if(!(n.FirstLeft===null||n.IsHole!==n.FirstLeft.IsHole&&n.FirstLeft.Pts!==null)){for(var r=n.FirstLeft;r!==null&&(r.IsHole===n.IsHole||r.Pts===null);)r=r.FirstLeft;n.FirstLeft=r}},i.Clipper.prototype.ExecuteInternal=function(){try{this.Reset(),this.m_SortedEdges=null,this.m_Maxima=null;var n={},r={};if(!this.PopScanbeam(n))return!1;for(this.InsertLocalMinimaIntoAEL(n.v);this.PopScanbeam(r)||this.LocalMinimaPending();){if(this.ProcessHorizontals(),this.m_GhostJoins.length=0,!this.ProcessIntersections(r.v))return!1;this.ProcessEdgesAtTopOfScanbeam(r.v),n.v=r.v,this.InsertLocalMinimaIntoAEL(n.v)}var a,c,f;for(c=0,f=this.m_PolyOuts.length;c<f;c++)a=this.m_PolyOuts[c],!(a.Pts===null||a.IsOpen)&&(a.IsHole^this.ReverseSolution)==this.Area$1(a)>0&&this.ReversePolyPtLinks(a.Pts);for(this.JoinCommonEdges(),c=0,f=this.m_PolyOuts.length;c<f;c++)a=this.m_PolyOuts[c],a.Pts!==null&&(a.IsOpen?this.FixupOutPolyline(a):this.FixupOutPolygon(a));return this.StrictlySimple&&this.DoSimplePolygons(),!0}finally{this.m_Joins.length=0,this.m_GhostJoins.length=0}},i.Clipper.prototype.DisposeAllPolyPts=function(){for(var n=0,r=this.m_PolyOuts.length;n<r;++n)this.DisposeOutRec(n);i.Clear(this.m_PolyOuts)},i.Clipper.prototype.AddJoin=function(n,r,a){var c=new i.Join;c.OutPt1=n,c.OutPt2=r,c.OffPt.X=a.X,c.OffPt.Y=a.Y,i.use_xyz&&(c.OffPt.Z=a.Z),this.m_Joins.push(c)},i.Clipper.prototype.AddGhostJoin=function(n,r){var a=new i.Join;a.OutPt1=n,a.OffPt.X=r.X,a.OffPt.Y=r.Y,i.use_xyz&&(a.OffPt.Z=r.Z),this.m_GhostJoins.push(a)},i.Clipper.prototype.SetZ=function(n,r,a){if(this.ZFillFunction!==null){if(n.Z!==0||this.ZFillFunction===null)return;i.IntPoint.op_Equality(n,r.Bot)?n.Z=r.Bot.Z:i.IntPoint.op_Equality(n,r.Top)?n.Z=r.Top.Z:i.IntPoint.op_Equality(n,a.Bot)?n.Z=a.Bot.Z:i.IntPoint.op_Equality(n,a.Top)?n.Z=a.Top.Z:this.ZFillFunction(r.Bot,r.Top,a.Bot,a.Top,n)}},i.Clipper.prototype.InsertLocalMinimaIntoAEL=function(n){for(var r={},a,c;this.PopLocalMinima(n,r);){a=r.v.LeftBound,c=r.v.RightBound;var f=null;if(a===null?(this.InsertEdgeIntoAEL(c,null),this.SetWindingCount(c),this.IsContributing(c)&&(f=this.AddOutPt(c,c.Bot))):c===null?(this.InsertEdgeIntoAEL(a,null),this.SetWindingCount(a),this.IsContributing(a)&&(f=this.AddOutPt(a,a.Bot)),this.InsertScanbeam(a.Top.Y)):(this.InsertEdgeIntoAEL(a,null),this.InsertEdgeIntoAEL(c,a),this.SetWindingCount(a),c.WindCnt=a.WindCnt,c.WindCnt2=a.WindCnt2,this.IsContributing(a)&&(f=this.AddLocalMinPoly(a,c,a.Bot)),this.InsertScanbeam(a.Top.Y)),c!==null&&(i.ClipperBase.IsHorizontal(c)?(c.NextInLML!==null&&this.InsertScanbeam(c.NextInLML.Top.Y),this.AddEdgeToSEL(c)):this.InsertScanbeam(c.Top.Y)),!(a===null||c===null)){if(f!==null&&i.ClipperBase.IsHorizontal(c)&&this.m_GhostJoins.length>0&&c.WindDelta!==0)for(var g=0,x=this.m_GhostJoins.length;g<x;g++){var M=this.m_GhostJoins[g];this.HorzSegmentsOverlap(M.OutPt1.Pt.X,M.OffPt.X,c.Bot.X,c.Top.X)&&this.AddJoin(M.OutPt1,f,M.OffPt)}if(a.OutIdx>=0&&a.PrevInAEL!==null&&a.PrevInAEL.Curr.X===a.Bot.X&&a.PrevInAEL.OutIdx>=0&&i.ClipperBase.SlopesEqual5(a.PrevInAEL.Curr,a.PrevInAEL.Top,a.Curr,a.Top,this.m_UseFullRange)&&a.WindDelta!==0&&a.PrevInAEL.WindDelta!==0){var b=this.AddOutPt(a.PrevInAEL,a.Bot);this.AddJoin(f,b,a.Top)}if(a.NextInAEL!==c){if(c.OutIdx>=0&&c.PrevInAEL.OutIdx>=0&&i.ClipperBase.SlopesEqual5(c.PrevInAEL.Curr,c.PrevInAEL.Top,c.Curr,c.Top,this.m_UseFullRange)&&c.WindDelta!==0&&c.PrevInAEL.WindDelta!==0){var b=this.AddOutPt(c.PrevInAEL,c.Bot);this.AddJoin(f,b,c.Top)}var w=a.NextInAEL;if(w!==null)for(;w!==c;)this.IntersectEdges(c,w,a.Curr),w=w.NextInAEL}}}},i.Clipper.prototype.InsertEdgeIntoAEL=function(n,r){if(this.m_ActiveEdges===null)n.PrevInAEL=null,n.NextInAEL=null,this.m_ActiveEdges=n;else if(r===null&&this.E2InsertsBeforeE1(this.m_ActiveEdges,n))n.PrevInAEL=null,n.NextInAEL=this.m_ActiveEdges,this.m_ActiveEdges.PrevInAEL=n,this.m_ActiveEdges=n;else{for(r===null&&(r=this.m_ActiveEdges);r.NextInAEL!==null&&!this.E2InsertsBeforeE1(r.NextInAEL,n);)r=r.NextInAEL;n.NextInAEL=r.NextInAEL,r.NextInAEL!==null&&(r.NextInAEL.PrevInAEL=n),n.PrevInAEL=r,r.NextInAEL=n}},i.Clipper.prototype.E2InsertsBeforeE1=function(n,r){return r.Curr.X===n.Curr.X?r.Top.Y>n.Top.Y?r.Top.X<i.Clipper.TopX(n,r.Top.Y):n.Top.X>i.Clipper.TopX(r,n.Top.Y):r.Curr.X<n.Curr.X},i.Clipper.prototype.IsEvenOddFillType=function(n){return n.PolyTyp===i.PolyType.ptSubject?this.m_SubjFillType===i.PolyFillType.pftEvenOdd:this.m_ClipFillType===i.PolyFillType.pftEvenOdd},i.Clipper.prototype.IsEvenOddAltFillType=function(n){return n.PolyTyp===i.PolyType.ptSubject?this.m_ClipFillType===i.PolyFillType.pftEvenOdd:this.m_SubjFillType===i.PolyFillType.pftEvenOdd},i.Clipper.prototype.IsContributing=function(n){var r,a;switch(n.PolyTyp===i.PolyType.ptSubject?(r=this.m_SubjFillType,a=this.m_ClipFillType):(r=this.m_ClipFillType,a=this.m_SubjFillType),r){case i.PolyFillType.pftEvenOdd:if(n.WindDelta===0&&n.WindCnt!==1)return!1;break;case i.PolyFillType.pftNonZero:if(Math.abs(n.WindCnt)!==1)return!1;break;case i.PolyFillType.pftPositive:if(n.WindCnt!==1)return!1;break;default:if(n.WindCnt!==-1)return!1;break}switch(this.m_ClipType){case i.ClipType.ctIntersection:switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2!==0;case i.PolyFillType.pftPositive:return n.WindCnt2>0;default:return n.WindCnt2<0}case i.ClipType.ctUnion:switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}case i.ClipType.ctDifference:if(n.PolyTyp===i.PolyType.ptSubject)switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}else switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2!==0;case i.PolyFillType.pftPositive:return n.WindCnt2>0;default:return n.WindCnt2<0}case i.ClipType.ctXor:if(n.WindDelta===0)switch(a){case i.PolyFillType.pftEvenOdd:case i.PolyFillType.pftNonZero:return n.WindCnt2===0;case i.PolyFillType.pftPositive:return n.WindCnt2<=0;default:return n.WindCnt2>=0}else return!0}return!0},i.Clipper.prototype.SetWindingCount=function(n){for(var r=n.PrevInAEL;r!==null&&(r.PolyTyp!==n.PolyTyp||r.WindDelta===0);)r=r.PrevInAEL;if(r===null){var a=n.PolyTyp===i.PolyType.ptSubject?this.m_SubjFillType:this.m_ClipFillType;n.WindDelta===0?n.WindCnt=a===i.PolyFillType.pftNegative?-1:1:n.WindCnt=n.WindDelta,n.WindCnt2=0,r=this.m_ActiveEdges}else if(n.WindDelta===0&&this.m_ClipType!==i.ClipType.ctUnion)n.WindCnt=1,n.WindCnt2=r.WindCnt2,r=r.NextInAEL;else if(this.IsEvenOddFillType(n)){if(n.WindDelta===0){for(var c=!0,f=r.PrevInAEL;f!==null;)f.PolyTyp===r.PolyTyp&&f.WindDelta!==0&&(c=!c),f=f.PrevInAEL;n.WindCnt=c?0:1}else n.WindCnt=n.WindDelta;n.WindCnt2=r.WindCnt2,r=r.NextInAEL}else r.WindCnt*r.WindDelta<0?Math.abs(r.WindCnt)>1?r.WindDelta*n.WindDelta<0?n.WindCnt=r.WindCnt:n.WindCnt=r.WindCnt+n.WindDelta:n.WindCnt=n.WindDelta===0?1:n.WindDelta:n.WindDelta===0?n.WindCnt=r.WindCnt<0?r.WindCnt-1:r.WindCnt+1:r.WindDelta*n.WindDelta<0?n.WindCnt=r.WindCnt:n.WindCnt=r.WindCnt+n.WindDelta,n.WindCnt2=r.WindCnt2,r=r.NextInAEL;if(this.IsEvenOddAltFillType(n))for(;r!==n;)r.WindDelta!==0&&(n.WindCnt2=n.WindCnt2===0?1:0),r=r.NextInAEL;else for(;r!==n;)n.WindCnt2+=r.WindDelta,r=r.NextInAEL},i.Clipper.prototype.AddEdgeToSEL=function(n){this.m_SortedEdges===null?(this.m_SortedEdges=n,n.PrevInSEL=null,n.NextInSEL=null):(n.NextInSEL=this.m_SortedEdges,n.PrevInSEL=null,this.m_SortedEdges.PrevInSEL=n,this.m_SortedEdges=n)},i.Clipper.prototype.PopEdgeFromSEL=function(n){if(n.v=this.m_SortedEdges,n.v===null)return!1;var r=n.v;return this.m_SortedEdges=n.v.NextInSEL,this.m_SortedEdges!==null&&(this.m_SortedEdges.PrevInSEL=null),r.NextInSEL=null,r.PrevInSEL=null,!0},i.Clipper.prototype.CopyAELToSEL=function(){var n=this.m_ActiveEdges;for(this.m_SortedEdges=n;n!==null;)n.PrevInSEL=n.PrevInAEL,n.NextInSEL=n.NextInAEL,n=n.NextInAEL},i.Clipper.prototype.SwapPositionsInSEL=function(n,r){if(!(n.NextInSEL===null&&n.PrevInSEL===null)&&!(r.NextInSEL===null&&r.PrevInSEL===null)){if(n.NextInSEL===r){var a=r.NextInSEL;a!==null&&(a.PrevInSEL=n);var c=n.PrevInSEL;c!==null&&(c.NextInSEL=r),r.PrevInSEL=c,r.NextInSEL=n,n.PrevInSEL=r,n.NextInSEL=a}else if(r.NextInSEL===n){var a=n.NextInSEL;a!==null&&(a.PrevInSEL=r);var c=r.PrevInSEL;c!==null&&(c.NextInSEL=n),n.PrevInSEL=c,n.NextInSEL=r,r.PrevInSEL=n,r.NextInSEL=a}else{var a=n.NextInSEL,c=n.PrevInSEL;n.NextInSEL=r.NextInSEL,n.NextInSEL!==null&&(n.NextInSEL.PrevInSEL=n),n.PrevInSEL=r.PrevInSEL,n.PrevInSEL!==null&&(n.PrevInSEL.NextInSEL=n),r.NextInSEL=a,r.NextInSEL!==null&&(r.NextInSEL.PrevInSEL=r),r.PrevInSEL=c,r.PrevInSEL!==null&&(r.PrevInSEL.NextInSEL=r)}n.PrevInSEL===null?this.m_SortedEdges=n:r.PrevInSEL===null&&(this.m_SortedEdges=r)}},i.Clipper.prototype.AddLocalMaxPoly=function(n,r,a){this.AddOutPt(n,a),r.WindDelta===0&&this.AddOutPt(r,a),n.OutIdx===r.OutIdx?(n.OutIdx=-1,r.OutIdx=-1):n.OutIdx<r.OutIdx?this.AppendPolygon(n,r):this.AppendPolygon(r,n)},i.Clipper.prototype.AddLocalMinPoly=function(n,r,a){var c,f,g;if(i.ClipperBase.IsHorizontal(r)||n.Dx>r.Dx?(c=this.AddOutPt(n,a),r.OutIdx=n.OutIdx,n.Side=i.EdgeSide.esLeft,r.Side=i.EdgeSide.esRight,f=n,f.PrevInAEL===r?g=r.PrevInAEL:g=f.PrevInAEL):(c=this.AddOutPt(r,a),n.OutIdx=r.OutIdx,n.Side=i.EdgeSide.esRight,r.Side=i.EdgeSide.esLeft,f=r,f.PrevInAEL===n?g=n.PrevInAEL:g=f.PrevInAEL),g!==null&&g.OutIdx>=0&&g.Top.Y<a.Y&&f.Top.Y<a.Y){var x=i.Clipper.TopX(g,a.Y),M=i.Clipper.TopX(f,a.Y);if(x===M&&f.WindDelta!==0&&g.WindDelta!==0&&i.ClipperBase.SlopesEqual5(new i.IntPoint2(x,a.Y),g.Top,new i.IntPoint2(M,a.Y),f.Top,this.m_UseFullRange)){var b=this.AddOutPt(g,a);this.AddJoin(c,b,f.Top)}}return c},i.Clipper.prototype.AddOutPt=function(n,r){if(n.OutIdx<0){var a=this.CreateOutRec();a.IsOpen=n.WindDelta===0;var c=new i.OutPt;return a.Pts=c,c.Idx=a.Idx,c.Pt.X=r.X,c.Pt.Y=r.Y,i.use_xyz&&(c.Pt.Z=r.Z),c.Next=c,c.Prev=c,a.IsOpen||this.SetHoleState(n,a),n.OutIdx=a.Idx,c}else{var a=this.m_PolyOuts[n.OutIdx],f=a.Pts,g=n.Side===i.EdgeSide.esLeft;if(g&&i.IntPoint.op_Equality(r,f.Pt))return f;if(!g&&i.IntPoint.op_Equality(r,f.Prev.Pt))return f.Prev;var c=new i.OutPt;return c.Idx=a.Idx,c.Pt.X=r.X,c.Pt.Y=r.Y,i.use_xyz&&(c.Pt.Z=r.Z),c.Next=f,c.Prev=f.Prev,c.Prev.Next=c,f.Prev=c,g&&(a.Pts=c),c}},i.Clipper.prototype.GetLastOutPt=function(n){var r=this.m_PolyOuts[n.OutIdx];return n.Side===i.EdgeSide.esLeft?r.Pts:r.Pts.Prev},i.Clipper.prototype.SwapPoints=function(n,r){var a=new i.IntPoint1(n.Value);n.Value.X=r.Value.X,n.Value.Y=r.Value.Y,i.use_xyz&&(n.Value.Z=r.Value.Z),r.Value.X=a.X,r.Value.Y=a.Y,i.use_xyz&&(r.Value.Z=a.Z)},i.Clipper.prototype.HorzSegmentsOverlap=function(n,r,a,c){var f;return n>r&&(f=n,n=r,r=f),a>c&&(f=a,a=c,c=f),n<c&&a<r},i.Clipper.prototype.SetHoleState=function(n,r){for(var a=n.PrevInAEL,c=null;a!==null;)a.OutIdx>=0&&a.WindDelta!==0&&(c===null?c=a:c.OutIdx===a.OutIdx&&(c=null)),a=a.PrevInAEL;c===null?(r.FirstLeft=null,r.IsHole=!1):(r.FirstLeft=this.m_PolyOuts[c.OutIdx],r.IsHole=!r.FirstLeft.IsHole)},i.Clipper.prototype.GetDx=function(n,r){return n.Y===r.Y?i.ClipperBase.horizontal:(r.X-n.X)/(r.Y-n.Y)},i.Clipper.prototype.FirstIsBottomPt=function(n,r){for(var a=n.Prev;i.IntPoint.op_Equality(a.Pt,n.Pt)&&a!==n;)a=a.Prev;var c=Math.abs(this.GetDx(n.Pt,a.Pt));for(a=n.Next;i.IntPoint.op_Equality(a.Pt,n.Pt)&&a!==n;)a=a.Next;var f=Math.abs(this.GetDx(n.Pt,a.Pt));for(a=r.Prev;i.IntPoint.op_Equality(a.Pt,r.Pt)&&a!==r;)a=a.Prev;var g=Math.abs(this.GetDx(r.Pt,a.Pt));for(a=r.Next;i.IntPoint.op_Equality(a.Pt,r.Pt)&&a!==r;)a=a.Next;var x=Math.abs(this.GetDx(r.Pt,a.Pt));return Math.max(c,f)===Math.max(g,x)&&Math.min(c,f)===Math.min(g,x)?this.Area(n)>0:c>=g&&c>=x||f>=g&&f>=x},i.Clipper.prototype.GetBottomPt=function(n){for(var r=null,a=n.Next;a!==n;)a.Pt.Y>n.Pt.Y?(n=a,r=null):a.Pt.Y===n.Pt.Y&&a.Pt.X<=n.Pt.X&&(a.Pt.X<n.Pt.X?(r=null,n=a):a.Next!==n&&a.Prev!==n&&(r=a)),a=a.Next;if(r!==null)for(;r!==a;)for(this.FirstIsBottomPt(a,r)||(n=r),r=r.Next;i.IntPoint.op_Inequality(r.Pt,n.Pt);)r=r.Next;return n},i.Clipper.prototype.GetLowermostRec=function(n,r){n.BottomPt===null&&(n.BottomPt=this.GetBottomPt(n.Pts)),r.BottomPt===null&&(r.BottomPt=this.GetBottomPt(r.Pts));var a=n.BottomPt,c=r.BottomPt;return a.Pt.Y>c.Pt.Y?n:a.Pt.Y<c.Pt.Y?r:a.Pt.X<c.Pt.X?n:a.Pt.X>c.Pt.X||a.Next===a?r:c.Next===c||this.FirstIsBottomPt(a,c)?n:r},i.Clipper.prototype.OutRec1RightOfOutRec2=function(n,r){do if(n=n.FirstLeft,n===r)return!0;while(n!==null);return!1},i.Clipper.prototype.GetOutRec=function(n){for(var r=this.m_PolyOuts[n];r!==this.m_PolyOuts[r.Idx];)r=this.m_PolyOuts[r.Idx];return r},i.Clipper.prototype.AppendPolygon=function(n,r){var a=this.m_PolyOuts[n.OutIdx],c=this.m_PolyOuts[r.OutIdx],f;this.OutRec1RightOfOutRec2(a,c)?f=c:this.OutRec1RightOfOutRec2(c,a)?f=a:f=this.GetLowermostRec(a,c);var g=a.Pts,x=g.Prev,M=c.Pts,b=M.Prev;n.Side===i.EdgeSide.esLeft?r.Side===i.EdgeSide.esLeft?(this.ReversePolyPtLinks(M),M.Next=g,g.Prev=M,x.Next=b,b.Prev=x,a.Pts=b):(b.Next=g,g.Prev=b,M.Prev=x,x.Next=M,a.Pts=M):r.Side===i.EdgeSide.esRight?(this.ReversePolyPtLinks(M),x.Next=b,b.Prev=x,M.Next=g,g.Prev=M):(x.Next=M,M.Prev=x,g.Prev=b,b.Next=g),a.BottomPt=null,f===c&&(c.FirstLeft!==a&&(a.FirstLeft=c.FirstLeft),a.IsHole=c.IsHole),c.Pts=null,c.BottomPt=null,c.FirstLeft=a;var w=n.OutIdx,L=r.OutIdx;n.OutIdx=-1,r.OutIdx=-1;for(var R=this.m_ActiveEdges;R!==null;){if(R.OutIdx===L){R.OutIdx=w,R.Side=n.Side;break}R=R.NextInAEL}c.Idx=a.Idx},i.Clipper.prototype.ReversePolyPtLinks=function(n){if(n!==null){var r,a;r=n;do a=r.Next,r.Next=r.Prev,r.Prev=a,r=a;while(r!==n)}},i.Clipper.SwapSides=function(n,r){var a=n.Side;n.Side=r.Side,r.Side=a},i.Clipper.SwapPolyIndexes=function(n,r){var a=n.OutIdx;n.OutIdx=r.OutIdx,r.OutIdx=a},i.Clipper.prototype.IntersectEdges=function(n,r,a){var c=n.OutIdx>=0,f=r.OutIdx>=0;if(i.use_xyz&&this.SetZ(a,n,r),i.use_lines&&(n.WindDelta===0||r.WindDelta===0)){if(n.WindDelta===0&&r.WindDelta===0)return;n.PolyTyp===r.PolyTyp&&n.WindDelta!==r.WindDelta&&this.m_ClipType===i.ClipType.ctUnion?n.WindDelta===0?f&&(this.AddOutPt(n,a),c&&(n.OutIdx=-1)):c&&(this.AddOutPt(r,a),f&&(r.OutIdx=-1)):n.PolyTyp!==r.PolyTyp&&(n.WindDelta===0&&Math.abs(r.WindCnt)===1&&(this.m_ClipType!==i.ClipType.ctUnion||r.WindCnt2===0)?(this.AddOutPt(n,a),c&&(n.OutIdx=-1)):r.WindDelta===0&&Math.abs(n.WindCnt)===1&&(this.m_ClipType!==i.ClipType.ctUnion||n.WindCnt2===0)&&(this.AddOutPt(r,a),f&&(r.OutIdx=-1)));return}if(n.PolyTyp===r.PolyTyp)if(this.IsEvenOddFillType(n)){var g=n.WindCnt;n.WindCnt=r.WindCnt,r.WindCnt=g}else n.WindCnt+r.WindDelta===0?n.WindCnt=-n.WindCnt:n.WindCnt+=r.WindDelta,r.WindCnt-n.WindDelta===0?r.WindCnt=-r.WindCnt:r.WindCnt-=n.WindDelta;else this.IsEvenOddFillType(r)?n.WindCnt2=n.WindCnt2===0?1:0:n.WindCnt2+=r.WindDelta,this.IsEvenOddFillType(n)?r.WindCnt2=r.WindCnt2===0?1:0:r.WindCnt2-=n.WindDelta;var x,M,b,w;n.PolyTyp===i.PolyType.ptSubject?(x=this.m_SubjFillType,b=this.m_ClipFillType):(x=this.m_ClipFillType,b=this.m_SubjFillType),r.PolyTyp===i.PolyType.ptSubject?(M=this.m_SubjFillType,w=this.m_ClipFillType):(M=this.m_ClipFillType,w=this.m_SubjFillType);var L,R;switch(x){case i.PolyFillType.pftPositive:L=n.WindCnt;break;case i.PolyFillType.pftNegative:L=-n.WindCnt;break;default:L=Math.abs(n.WindCnt);break}switch(M){case i.PolyFillType.pftPositive:R=r.WindCnt;break;case i.PolyFillType.pftNegative:R=-r.WindCnt;break;default:R=Math.abs(r.WindCnt);break}if(c&&f)L!==0&&L!==1||R!==0&&R!==1||n.PolyTyp!==r.PolyTyp&&this.m_ClipType!==i.ClipType.ctXor?this.AddLocalMaxPoly(n,r,a):(this.AddOutPt(n,a),this.AddOutPt(r,a),i.Clipper.SwapSides(n,r),i.Clipper.SwapPolyIndexes(n,r));else if(c)(R===0||R===1)&&(this.AddOutPt(n,a),i.Clipper.SwapSides(n,r),i.Clipper.SwapPolyIndexes(n,r));else if(f)(L===0||L===1)&&(this.AddOutPt(r,a),i.Clipper.SwapSides(n,r),i.Clipper.SwapPolyIndexes(n,r));else if((L===0||L===1)&&(R===0||R===1)){var F,G;switch(b){case i.PolyFillType.pftPositive:F=n.WindCnt2;break;case i.PolyFillType.pftNegative:F=-n.WindCnt2;break;default:F=Math.abs(n.WindCnt2);break}switch(w){case i.PolyFillType.pftPositive:G=r.WindCnt2;break;case i.PolyFillType.pftNegative:G=-r.WindCnt2;break;default:G=Math.abs(r.WindCnt2);break}if(n.PolyTyp!==r.PolyTyp)this.AddLocalMinPoly(n,r,a);else if(L===1&&R===1)switch(this.m_ClipType){case i.ClipType.ctIntersection:F>0&&G>0&&this.AddLocalMinPoly(n,r,a);break;case i.ClipType.ctUnion:F<=0&&G<=0&&this.AddLocalMinPoly(n,r,a);break;case i.ClipType.ctDifference:(n.PolyTyp===i.PolyType.ptClip&&F>0&&G>0||n.PolyTyp===i.PolyType.ptSubject&&F<=0&&G<=0)&&this.AddLocalMinPoly(n,r,a);break;case i.ClipType.ctXor:this.AddLocalMinPoly(n,r,a);break}else i.Clipper.SwapSides(n,r)}},i.Clipper.prototype.DeleteFromSEL=function(n){var r=n.PrevInSEL,a=n.NextInSEL;r===null&&a===null&&n!==this.m_SortedEdges||(r!==null?r.NextInSEL=a:this.m_SortedEdges=a,a!==null&&(a.PrevInSEL=r),n.NextInSEL=null,n.PrevInSEL=null)},i.Clipper.prototype.ProcessHorizontals=function(){for(var n={};this.PopEdgeFromSEL(n);)this.ProcessHorizontal(n.v)},i.Clipper.prototype.GetHorzDirection=function(n,r){n.Bot.X<n.Top.X?(r.Left=n.Bot.X,r.Right=n.Top.X,r.Dir=i.Direction.dLeftToRight):(r.Left=n.Top.X,r.Right=n.Bot.X,r.Dir=i.Direction.dRightToLeft)},i.Clipper.prototype.ProcessHorizontal=function(n){var r={Dir:null,Left:null,Right:null};this.GetHorzDirection(n,r);for(var a=r.Dir,c=r.Left,f=r.Right,g=n.WindDelta===0,x=n,M=null;x.NextInLML!==null&&i.ClipperBase.IsHorizontal(x.NextInLML);)x=x.NextInLML;x.NextInLML===null&&(M=this.GetMaximaPair(x));var b=this.m_Maxima;if(b!==null)if(a===i.Direction.dLeftToRight){for(;b!==null&&b.X<=n.Bot.X;)b=b.Next;b!==null&&b.X>=x.Top.X&&(b=null)}else{for(;b.Next!==null&&b.Next.X<n.Bot.X;)b=b.Next;b.X<=x.Top.X&&(b=null)}for(var w=null;;){for(var L=n===x,R=this.GetNextInAEL(n,a);R!==null;){if(b!==null)if(a===i.Direction.dLeftToRight)for(;b!==null&&b.X<R.Curr.X;)n.OutIdx>=0&&!g&&this.AddOutPt(n,new i.IntPoint2(b.X,n.Bot.Y)),b=b.Next;else for(;b!==null&&b.X>R.Curr.X;)n.OutIdx>=0&&!g&&this.AddOutPt(n,new i.IntPoint2(b.X,n.Bot.Y)),b=b.Prev;if(a===i.Direction.dLeftToRight&&R.Curr.X>f||a===i.Direction.dRightToLeft&&R.Curr.X<c||R.Curr.X===n.Top.X&&n.NextInLML!==null&&R.Dx<n.NextInLML.Dx)break;if(n.OutIdx>=0&&!g){i.use_xyz&&(a===i.Direction.dLeftToRight?this.SetZ(R.Curr,n,R):this.SetZ(R.Curr,R,n)),w=this.AddOutPt(n,R.Curr);for(var F=this.m_SortedEdges;F!==null;){if(F.OutIdx>=0&&this.HorzSegmentsOverlap(n.Bot.X,n.Top.X,F.Bot.X,F.Top.X)){var G=this.GetLastOutPt(F);this.AddJoin(G,w,F.Top)}F=F.NextInSEL}this.AddGhostJoin(w,n.Bot)}if(R===M&&L){n.OutIdx>=0&&this.AddLocalMaxPoly(n,M,n.Top),this.DeleteFromAEL(n),this.DeleteFromAEL(M);return}if(a===i.Direction.dLeftToRight){var J=new i.IntPoint2(R.Curr.X,n.Curr.Y);this.IntersectEdges(n,R,J)}else{var J=new i.IntPoint2(R.Curr.X,n.Curr.Y);this.IntersectEdges(R,n,J)}var $=this.GetNextInAEL(R,a);this.SwapPositionsInAEL(n,R),R=$}if(n.NextInLML===null||!i.ClipperBase.IsHorizontal(n.NextInLML))break;n=this.UpdateEdgeIntoAEL(n),n.OutIdx>=0&&this.AddOutPt(n,n.Bot),r={Dir:a,Left:c,Right:f},this.GetHorzDirection(n,r),a=r.Dir,c=r.Left,f=r.Right}if(n.OutIdx>=0&&w===null){w=this.GetLastOutPt(n);for(var F=this.m_SortedEdges;F!==null;){if(F.OutIdx>=0&&this.HorzSegmentsOverlap(n.Bot.X,n.Top.X,F.Bot.X,F.Top.X)){var G=this.GetLastOutPt(F);this.AddJoin(G,w,F.Top)}F=F.NextInSEL}this.AddGhostJoin(w,n.Top)}if(n.NextInLML!==null)if(n.OutIdx>=0){if(w=this.AddOutPt(n,n.Top),n=this.UpdateEdgeIntoAEL(n),n.WindDelta===0)return;var et=n.PrevInAEL,$=n.NextInAEL;if(et!==null&&et.Curr.X===n.Bot.X&&et.Curr.Y===n.Bot.Y&&et.WindDelta===0&&et.OutIdx>=0&&et.Curr.Y>et.Top.Y&&i.ClipperBase.SlopesEqual3(n,et,this.m_UseFullRange)){var G=this.AddOutPt(et,n.Bot);this.AddJoin(w,G,n.Top)}else if($!==null&&$.Curr.X===n.Bot.X&&$.Curr.Y===n.Bot.Y&&$.WindDelta!==0&&$.OutIdx>=0&&$.Curr.Y>$.Top.Y&&i.ClipperBase.SlopesEqual3(n,$,this.m_UseFullRange)){var G=this.AddOutPt($,n.Bot);this.AddJoin(w,G,n.Top)}}else n=this.UpdateEdgeIntoAEL(n);else n.OutIdx>=0&&this.AddOutPt(n,n.Top),this.DeleteFromAEL(n)},i.Clipper.prototype.GetNextInAEL=function(n,r){return r===i.Direction.dLeftToRight?n.NextInAEL:n.PrevInAEL},i.Clipper.prototype.IsMinima=function(n){return n!==null&&n.Prev.NextInLML!==n&&n.Next.NextInLML!==n},i.Clipper.prototype.IsMaxima=function(n,r){return n!==null&&n.Top.Y===r&&n.NextInLML===null},i.Clipper.prototype.IsIntermediate=function(n,r){return n.Top.Y===r&&n.NextInLML!==null},i.Clipper.prototype.GetMaximaPair=function(n){return i.IntPoint.op_Equality(n.Next.Top,n.Top)&&n.Next.NextInLML===null?n.Next:i.IntPoint.op_Equality(n.Prev.Top,n.Top)&&n.Prev.NextInLML===null?n.Prev:null},i.Clipper.prototype.GetMaximaPairEx=function(n){var r=this.GetMaximaPair(n);return r===null||r.OutIdx===i.ClipperBase.Skip||r.NextInAEL===r.PrevInAEL&&!i.ClipperBase.IsHorizontal(r)?null:r},i.Clipper.prototype.ProcessIntersections=function(n){if(this.m_ActiveEdges===null)return!0;try{if(this.BuildIntersectList(n),this.m_IntersectList.length===0)return!0;if(this.m_IntersectList.length===1||this.FixupIntersectionOrder())this.ProcessIntersectList();else return!1}catch{this.m_SortedEdges=null,this.m_IntersectList.length=0,i.Error("ProcessIntersections error")}return this.m_SortedEdges=null,!0},i.Clipper.prototype.BuildIntersectList=function(n){if(this.m_ActiveEdges!==null){var r=this.m_ActiveEdges;for(this.m_SortedEdges=r;r!==null;)r.PrevInSEL=r.PrevInAEL,r.NextInSEL=r.NextInAEL,r.Curr.X=i.Clipper.TopX(r,n),r=r.NextInAEL;for(var a=!0;a&&this.m_SortedEdges!==null;){for(a=!1,r=this.m_SortedEdges;r.NextInSEL!==null;){var c=r.NextInSEL,f=new i.IntPoint0;if(r.Curr.X>c.Curr.X){this.IntersectPoint(r,c,f),f.Y<n&&(f=new i.IntPoint2(i.Clipper.TopX(r,n),n));var g=new i.IntersectNode;g.Edge1=r,g.Edge2=c,g.Pt.X=f.X,g.Pt.Y=f.Y,i.use_xyz&&(g.Pt.Z=f.Z),this.m_IntersectList.push(g),this.SwapPositionsInSEL(r,c),a=!0}else r=c}if(r.PrevInSEL!==null)r.PrevInSEL.NextInSEL=null;else break}this.m_SortedEdges=null}},i.Clipper.prototype.EdgesAdjacent=function(n){return n.Edge1.NextInSEL===n.Edge2||n.Edge1.PrevInSEL===n.Edge2},i.Clipper.IntersectNodeSort=function(n,r){return r.Pt.Y-n.Pt.Y},i.Clipper.prototype.FixupIntersectionOrder=function(){this.m_IntersectList.sort(this.m_IntersectNodeComparer),this.CopyAELToSEL();for(var n=this.m_IntersectList.length,r=0;r<n;r++){if(!this.EdgesAdjacent(this.m_IntersectList[r])){for(var a=r+1;a<n&&!this.EdgesAdjacent(this.m_IntersectList[a]);)a++;if(a===n)return!1;var c=this.m_IntersectList[r];this.m_IntersectList[r]=this.m_IntersectList[a],this.m_IntersectList[a]=c}this.SwapPositionsInSEL(this.m_IntersectList[r].Edge1,this.m_IntersectList[r].Edge2)}return!0},i.Clipper.prototype.ProcessIntersectList=function(){for(var n=0,r=this.m_IntersectList.length;n<r;n++){var a=this.m_IntersectList[n];this.IntersectEdges(a.Edge1,a.Edge2,a.Pt),this.SwapPositionsInAEL(a.Edge1,a.Edge2)}this.m_IntersectList.length=0};var oa=function(n){return n<0?Math.ceil(n-.5):Math.round(n)},aa=function(n){return n<0?Math.ceil(n-.5):Math.floor(n+.5)},la=function(n){return n<0?-Math.round(Math.abs(n)):Math.round(n)},ca=function(n){return n<0?(n-=.5,n<-2147483648?Math.ceil(n):n|0):(n+=.5,n>2147483647?Math.floor(n):n|0)};o.msie?i.Clipper.Round=oa:o.chromium?i.Clipper.Round=la:o.safari?i.Clipper.Round=ca:i.Clipper.Round=aa,i.Clipper.TopX=function(n,r){return r===n.Top.Y?n.Top.X:n.Bot.X+i.Clipper.Round(n.Dx*(r-n.Bot.Y))},i.Clipper.prototype.IntersectPoint=function(n,r,a){a.X=0,a.Y=0;var c,f;if(n.Dx===r.Dx){a.Y=n.Curr.Y,a.X=i.Clipper.TopX(n,a.Y);return}if(n.Delta.X===0)a.X=n.Bot.X,i.ClipperBase.IsHorizontal(r)?a.Y=r.Bot.Y:(f=r.Bot.Y-r.Bot.X/r.Dx,a.Y=i.Clipper.Round(a.X/r.Dx+f));else if(r.Delta.X===0)a.X=r.Bot.X,i.ClipperBase.IsHorizontal(n)?a.Y=n.Bot.Y:(c=n.Bot.Y-n.Bot.X/n.Dx,a.Y=i.Clipper.Round(a.X/n.Dx+c));else{c=n.Bot.X-n.Bot.Y*n.Dx,f=r.Bot.X-r.Bot.Y*r.Dx;var g=(f-c)/(n.Dx-r.Dx);a.Y=i.Clipper.Round(g),Math.abs(n.Dx)<Math.abs(r.Dx)?a.X=i.Clipper.Round(n.Dx*g+c):a.X=i.Clipper.Round(r.Dx*g+f)}if(a.Y<n.Top.Y||a.Y<r.Top.Y){if(n.Top.Y>r.Top.Y)return a.Y=n.Top.Y,a.X=i.Clipper.TopX(r,n.Top.Y),a.X<n.Top.X;a.Y=r.Top.Y,Math.abs(n.Dx)<Math.abs(r.Dx)?a.X=i.Clipper.TopX(n,a.Y):a.X=i.Clipper.TopX(r,a.Y)}a.Y>n.Curr.Y&&(a.Y=n.Curr.Y,Math.abs(n.Dx)>Math.abs(r.Dx)?a.X=i.Clipper.TopX(r,a.Y):a.X=i.Clipper.TopX(n,a.Y))},i.Clipper.prototype.ProcessEdgesAtTopOfScanbeam=function(n){for(var r=this.m_ActiveEdges;r!==null;){var a=this.IsMaxima(r,n);if(a){var c=this.GetMaximaPairEx(r);a=c===null||!i.ClipperBase.IsHorizontal(c)}if(a){this.StrictlySimple&&this.InsertMaxima(r.Top.X);var f=r.PrevInAEL;this.DoMaxima(r),f===null?r=this.m_ActiveEdges:r=f.NextInAEL}else{if(this.IsIntermediate(r,n)&&i.ClipperBase.IsHorizontal(r.NextInLML)?(r=this.UpdateEdgeIntoAEL(r),r.OutIdx>=0&&this.AddOutPt(r,r.Bot),this.AddEdgeToSEL(r)):(r.Curr.X=i.Clipper.TopX(r,n),r.Curr.Y=n),i.use_xyz&&(r.Top.Y===n?r.Curr.Z=r.Top.Z:r.Bot.Y===n?r.Curr.Z=r.Bot.Z:r.Curr.Z=0),this.StrictlySimple){var f=r.PrevInAEL;if(r.OutIdx>=0&&r.WindDelta!==0&&f!==null&&f.OutIdx>=0&&f.Curr.X===r.Curr.X&&f.WindDelta!==0){var g=new i.IntPoint1(r.Curr);i.use_xyz&&this.SetZ(g,f,r);var x=this.AddOutPt(f,g),M=this.AddOutPt(r,g);this.AddJoin(x,M,g)}}r=r.NextInAEL}}for(this.ProcessHorizontals(),this.m_Maxima=null,r=this.m_ActiveEdges;r!==null;){if(this.IsIntermediate(r,n)){var x=null;r.OutIdx>=0&&(x=this.AddOutPt(r,r.Top)),r=this.UpdateEdgeIntoAEL(r);var f=r.PrevInAEL,b=r.NextInAEL;if(f!==null&&f.Curr.X===r.Bot.X&&f.Curr.Y===r.Bot.Y&&x!==null&&f.OutIdx>=0&&f.Curr.Y===f.Top.Y&&i.ClipperBase.SlopesEqual5(r.Curr,r.Top,f.Curr,f.Top,this.m_UseFullRange)&&r.WindDelta!==0&&f.WindDelta!==0){var M=this.AddOutPt(ePrev2,r.Bot);this.AddJoin(x,M,r.Top)}else if(b!==null&&b.Curr.X===r.Bot.X&&b.Curr.Y===r.Bot.Y&&x!==null&&b.OutIdx>=0&&b.Curr.Y===b.Top.Y&&i.ClipperBase.SlopesEqual5(r.Curr,r.Top,b.Curr,b.Top,this.m_UseFullRange)&&r.WindDelta!==0&&b.WindDelta!==0){var M=this.AddOutPt(b,r.Bot);this.AddJoin(x,M,r.Top)}}r=r.NextInAEL}},i.Clipper.prototype.DoMaxima=function(n){var r=this.GetMaximaPairEx(n);if(r===null){n.OutIdx>=0&&this.AddOutPt(n,n.Top),this.DeleteFromAEL(n);return}for(var a=n.NextInAEL;a!==null&&a!==r;)this.IntersectEdges(n,a,n.Top),this.SwapPositionsInAEL(n,a),a=n.NextInAEL;n.OutIdx===-1&&r.OutIdx===-1?(this.DeleteFromAEL(n),this.DeleteFromAEL(r)):n.OutIdx>=0&&r.OutIdx>=0?(n.OutIdx>=0&&this.AddLocalMaxPoly(n,r,n.Top),this.DeleteFromAEL(n),this.DeleteFromAEL(r)):i.use_lines&&n.WindDelta===0?(n.OutIdx>=0&&(this.AddOutPt(n,n.Top),n.OutIdx=i.ClipperBase.Unassigned),this.DeleteFromAEL(n),r.OutIdx>=0&&(this.AddOutPt(r,n.Top),r.OutIdx=i.ClipperBase.Unassigned),this.DeleteFromAEL(r)):i.Error("DoMaxima error")},i.Clipper.ReversePaths=function(n){for(var r=0,a=n.length;r<a;r++)n[r].reverse()},i.Clipper.Orientation=function(n){return i.Clipper.Area(n)>=0},i.Clipper.prototype.PointCount=function(n){if(n===null)return 0;var r=0,a=n;do r++,a=a.Next;while(a!==n);return r},i.Clipper.prototype.BuildResult=function(n){i.Clear(n);for(var r=0,a=this.m_PolyOuts.length;r<a;r++){var c=this.m_PolyOuts[r];if(c.Pts!==null){var f=c.Pts.Prev,g=this.PointCount(f);if(!(g<2)){for(var x=new Array(g),M=0;M<g;M++)x[M]=f.Pt,f=f.Prev;n.push(x)}}}},i.Clipper.prototype.BuildResult2=function(n){n.Clear();for(var r=0,a=this.m_PolyOuts.length;r<a;r++){var c=this.m_PolyOuts[r],f=this.PointCount(c.Pts);if(!(c.IsOpen&&f<2||!c.IsOpen&&f<3)){this.FixHoleLinkage(c);var g=new i.PolyNode;n.m_AllPolys.push(g),c.PolyNode=g,g.m_polygon.length=f;for(var x=c.Pts.Prev,M=0;M<f;M++)g.m_polygon[M]=x.Pt,x=x.Prev}}for(var r=0,a=this.m_PolyOuts.length;r<a;r++){var c=this.m_PolyOuts[r];c.PolyNode!==null&&(c.IsOpen?(c.PolyNode.IsOpen=!0,n.AddChild(c.PolyNode)):c.FirstLeft!==null&&c.FirstLeft.PolyNode!==null?c.FirstLeft.PolyNode.AddChild(c.PolyNode):n.AddChild(c.PolyNode))}},i.Clipper.prototype.FixupOutPolyline=function(n){for(var r=n.Pts,a=r.Prev;r!==a;)if(r=r.Next,i.IntPoint.op_Equality(r.Pt,r.Prev.Pt)){r===a&&(a=r.Prev);var c=r.Prev;c.Next=r.Next,r.Next.Prev=c,r=c}r===r.Prev&&(n.Pts=null)},i.Clipper.prototype.FixupOutPolygon=function(n){var r=null;n.BottomPt=null;for(var a=n.Pts,c=this.PreserveCollinear||this.StrictlySimple;;){if(a.Prev===a||a.Prev===a.Next){n.Pts=null;return}if(i.IntPoint.op_Equality(a.Pt,a.Next.Pt)||i.IntPoint.op_Equality(a.Pt,a.Prev.Pt)||i.ClipperBase.SlopesEqual4(a.Prev.Pt,a.Pt,a.Next.Pt,this.m_UseFullRange)&&(!c||!this.Pt2IsBetweenPt1AndPt3(a.Prev.Pt,a.Pt,a.Next.Pt)))r=null,a.Prev.Next=a.Next,a.Next.Prev=a.Prev,a=a.Prev;else{if(a===r)break;r===null&&(r=a),a=a.Next}}n.Pts=a},i.Clipper.prototype.DupOutPt=function(n,r){var a=new i.OutPt;return a.Pt.X=n.Pt.X,a.Pt.Y=n.Pt.Y,i.use_xyz&&(a.Pt.Z=n.Pt.Z),a.Idx=n.Idx,r?(a.Next=n.Next,a.Prev=n,n.Next.Prev=a,n.Next=a):(a.Prev=n.Prev,a.Next=n,n.Prev.Next=a,n.Prev=a),a},i.Clipper.prototype.GetOverlap=function(n,r,a,c,f){return n<r?a<c?(f.Left=Math.max(n,a),f.Right=Math.min(r,c)):(f.Left=Math.max(n,c),f.Right=Math.min(r,a)):a<c?(f.Left=Math.max(r,a),f.Right=Math.min(n,c)):(f.Left=Math.max(r,c),f.Right=Math.min(n,a)),f.Left<f.Right},i.Clipper.prototype.JoinHorz=function(n,r,a,c,f,g){var x=n.Pt.X>r.Pt.X?i.Direction.dRightToLeft:i.Direction.dLeftToRight,M=a.Pt.X>c.Pt.X?i.Direction.dRightToLeft:i.Direction.dLeftToRight;if(x===M)return!1;if(x===i.Direction.dLeftToRight){for(;n.Next.Pt.X<=f.X&&n.Next.Pt.X>=n.Pt.X&&n.Next.Pt.Y===f.Y;)n=n.Next;g&&n.Pt.X!==f.X&&(n=n.Next),r=this.DupOutPt(n,!g),i.IntPoint.op_Inequality(r.Pt,f)&&(n=r,n.Pt.X=f.X,n.Pt.Y=f.Y,i.use_xyz&&(n.Pt.Z=f.Z),r=this.DupOutPt(n,!g))}else{for(;n.Next.Pt.X>=f.X&&n.Next.Pt.X<=n.Pt.X&&n.Next.Pt.Y===f.Y;)n=n.Next;!g&&n.Pt.X!==f.X&&(n=n.Next),r=this.DupOutPt(n,g),i.IntPoint.op_Inequality(r.Pt,f)&&(n=r,n.Pt.X=f.X,n.Pt.Y=f.Y,i.use_xyz&&(n.Pt.Z=f.Z),r=this.DupOutPt(n,g))}if(M===i.Direction.dLeftToRight){for(;a.Next.Pt.X<=f.X&&a.Next.Pt.X>=a.Pt.X&&a.Next.Pt.Y===f.Y;)a=a.Next;g&&a.Pt.X!==f.X&&(a=a.Next),c=this.DupOutPt(a,!g),i.IntPoint.op_Inequality(c.Pt,f)&&(a=c,a.Pt.X=f.X,a.Pt.Y=f.Y,i.use_xyz&&(a.Pt.Z=f.Z),c=this.DupOutPt(a,!g))}else{for(;a.Next.Pt.X>=f.X&&a.Next.Pt.X<=a.Pt.X&&a.Next.Pt.Y===f.Y;)a=a.Next;!g&&a.Pt.X!==f.X&&(a=a.Next),c=this.DupOutPt(a,g),i.IntPoint.op_Inequality(c.Pt,f)&&(a=c,a.Pt.X=f.X,a.Pt.Y=f.Y,i.use_xyz&&(a.Pt.Z=f.Z),c=this.DupOutPt(a,g))}return x===i.Direction.dLeftToRight===g?(n.Prev=a,a.Next=n,r.Next=c,c.Prev=r):(n.Next=a,a.Prev=n,r.Prev=c,c.Next=r),!0},i.Clipper.prototype.JoinPoints=function(n,r,a){var c=n.OutPt1,f=new i.OutPt,g=n.OutPt2,x=new i.OutPt,M=n.OutPt1.Pt.Y===n.OffPt.Y;if(M&&i.IntPoint.op_Equality(n.OffPt,n.OutPt1.Pt)&&i.IntPoint.op_Equality(n.OffPt,n.OutPt2.Pt)){if(r!==a)return!1;for(f=n.OutPt1.Next;f!==c&&i.IntPoint.op_Equality(f.Pt,n.OffPt);)f=f.Next;var b=f.Pt.Y>n.OffPt.Y;for(x=n.OutPt2.Next;x!==g&&i.IntPoint.op_Equality(x.Pt,n.OffPt);)x=x.Next;var w=x.Pt.Y>n.OffPt.Y;return b===w?!1:b?(f=this.DupOutPt(c,!1),x=this.DupOutPt(g,!0),c.Prev=g,g.Next=c,f.Next=x,x.Prev=f,n.OutPt1=c,n.OutPt2=f,!0):(f=this.DupOutPt(c,!0),x=this.DupOutPt(g,!1),c.Next=g,g.Prev=c,f.Prev=x,x.Next=f,n.OutPt1=c,n.OutPt2=f,!0)}else if(M){for(f=c;c.Prev.Pt.Y===c.Pt.Y&&c.Prev!==f&&c.Prev!==g;)c=c.Prev;for(;f.Next.Pt.Y===f.Pt.Y&&f.Next!==c&&f.Next!==g;)f=f.Next;if(f.Next===c||f.Next===g)return!1;for(x=g;g.Prev.Pt.Y===g.Pt.Y&&g.Prev!==x&&g.Prev!==f;)g=g.Prev;for(;x.Next.Pt.Y===x.Pt.Y&&x.Next!==g&&x.Next!==c;)x=x.Next;if(x.Next===g||x.Next===c)return!1;var L={Left:null,Right:null};if(!this.GetOverlap(c.Pt.X,f.Pt.X,g.Pt.X,x.Pt.X,L))return!1;var R=L.Left,F=L.Right,G=new i.IntPoint0,J;return c.Pt.X>=R&&c.Pt.X<=F?(G.X=c.Pt.X,G.Y=c.Pt.Y,i.use_xyz&&(G.Z=c.Pt.Z),J=c.Pt.X>f.Pt.X):g.Pt.X>=R&&g.Pt.X<=F?(G.X=g.Pt.X,G.Y=g.Pt.Y,i.use_xyz&&(G.Z=g.Pt.Z),J=g.Pt.X>x.Pt.X):f.Pt.X>=R&&f.Pt.X<=F?(G.X=f.Pt.X,G.Y=f.Pt.Y,i.use_xyz&&(G.Z=f.Pt.Z),J=f.Pt.X>c.Pt.X):(G.X=x.Pt.X,G.Y=x.Pt.Y,i.use_xyz&&(G.Z=x.Pt.Z),J=x.Pt.X>g.Pt.X),n.OutPt1=c,n.OutPt2=g,this.JoinHorz(c,f,g,x,G,J)}else{for(f=c.Next;i.IntPoint.op_Equality(f.Pt,c.Pt)&&f!==c;)f=f.Next;var $=f.Pt.Y>c.Pt.Y||!i.ClipperBase.SlopesEqual4(c.Pt,f.Pt,n.OffPt,this.m_UseFullRange);if($){for(f=c.Prev;i.IntPoint.op_Equality(f.Pt,c.Pt)&&f!==c;)f=f.Prev;if(f.Pt.Y>c.Pt.Y||!i.ClipperBase.SlopesEqual4(c.Pt,f.Pt,n.OffPt,this.m_UseFullRange))return!1}for(x=g.Next;i.IntPoint.op_Equality(x.Pt,g.Pt)&&x!==g;)x=x.Next;var et=x.Pt.Y>g.Pt.Y||!i.ClipperBase.SlopesEqual4(g.Pt,x.Pt,n.OffPt,this.m_UseFullRange);if(et){for(x=g.Prev;i.IntPoint.op_Equality(x.Pt,g.Pt)&&x!==g;)x=x.Prev;if(x.Pt.Y>g.Pt.Y||!i.ClipperBase.SlopesEqual4(g.Pt,x.Pt,n.OffPt,this.m_UseFullRange))return!1}return f===c||x===g||f===x||r===a&&$===et?!1:$?(f=this.DupOutPt(c,!1),x=this.DupOutPt(g,!0),c.Prev=g,g.Next=c,f.Next=x,x.Prev=f,n.OutPt1=c,n.OutPt2=f,!0):(f=this.DupOutPt(c,!0),x=this.DupOutPt(g,!1),c.Next=g,g.Prev=c,f.Prev=x,x.Next=f,n.OutPt1=c,n.OutPt2=f,!0)}},i.Clipper.GetBounds=function(n){for(var r=0,a=n.length;r<a&&n[r].length===0;)r++;if(r===a)return new i.IntRect(0,0,0,0);var c=new i.IntRect;for(c.left=n[r][0].X,c.right=c.left,c.top=n[r][0].Y,c.bottom=c.top;r<a;r++)for(var f=0,g=n[r].length;f<g;f++)n[r][f].X<c.left?c.left=n[r][f].X:n[r][f].X>c.right&&(c.right=n[r][f].X),n[r][f].Y<c.top?c.top=n[r][f].Y:n[r][f].Y>c.bottom&&(c.bottom=n[r][f].Y);return c},i.Clipper.prototype.GetBounds2=function(n){var r=n,a=new i.IntRect;for(a.left=n.Pt.X,a.right=n.Pt.X,a.top=n.Pt.Y,a.bottom=n.Pt.Y,n=n.Next;n!==r;)n.Pt.X<a.left&&(a.left=n.Pt.X),n.Pt.X>a.right&&(a.right=n.Pt.X),n.Pt.Y<a.top&&(a.top=n.Pt.Y),n.Pt.Y>a.bottom&&(a.bottom=n.Pt.Y),n=n.Next;return a},i.Clipper.PointInPolygon=function(n,r){var a=0,c=r.length;if(c<3)return 0;for(var f=r[0],g=1;g<=c;++g){var x=g===c?r[0]:r[g];if(x.Y===n.Y&&(x.X===n.X||f.Y===n.Y&&x.X>n.X==f.X<n.X))return-1;if(f.Y<n.Y!=x.Y<n.Y){if(f.X>=n.X)if(x.X>n.X)a=1-a;else{var M=(f.X-n.X)*(x.Y-n.Y)-(x.X-n.X)*(f.Y-n.Y);if(M===0)return-1;M>0==x.Y>f.Y&&(a=1-a)}else if(x.X>n.X){var M=(f.X-n.X)*(x.Y-n.Y)-(x.X-n.X)*(f.Y-n.Y);if(M===0)return-1;M>0==x.Y>f.Y&&(a=1-a)}}f=x}return a},i.Clipper.prototype.PointInPolygon=function(n,r){var a=0,c=r,f=n.X,g=n.Y,x=r.Pt.X,M=r.Pt.Y;do{r=r.Next;var b=r.Pt.X,w=r.Pt.Y;if(w===g&&(b===f||M===g&&b>f==x<f))return-1;if(M<g!=w<g){if(x>=f)if(b>f)a=1-a;else{var L=(x-f)*(w-g)-(b-f)*(M-g);if(L===0)return-1;L>0==w>M&&(a=1-a)}else if(b>f){var L=(x-f)*(w-g)-(b-f)*(M-g);if(L===0)return-1;L>0==w>M&&(a=1-a)}}x=b,M=w}while(c!==r);return a},i.Clipper.prototype.Poly2ContainsPoly1=function(n,r){var a=n;do{var c=this.PointInPolygon(a.Pt,r);if(c>=0)return c>0;a=a.Next}while(a!==n);return!0},i.Clipper.prototype.FixupFirstLefts1=function(n,r){for(var a,c,f=0,g=this.m_PolyOuts.length;f<g;f++)a=this.m_PolyOuts[f],c=i.Clipper.ParseFirstLeft(a.FirstLeft),a.Pts!==null&&c===n&&this.Poly2ContainsPoly1(a.Pts,r.Pts)&&(a.FirstLeft=r)},i.Clipper.prototype.FixupFirstLefts2=function(n,r){for(var a=r.FirstLeft,c,f,g=0,x=this.m_PolyOuts.length;g<x;g++)c=this.m_PolyOuts[g],!(c.Pts===null||c===r||c===n)&&(f=i.Clipper.ParseFirstLeft(c.FirstLeft),!(f!==a&&f!==n&&f!==r)&&(this.Poly2ContainsPoly1(c.Pts,n.Pts)?c.FirstLeft=n:this.Poly2ContainsPoly1(c.Pts,r.Pts)?c.FirstLeft=r:(c.FirstLeft===n||c.FirstLeft===r)&&(c.FirstLeft=a)))},i.Clipper.prototype.FixupFirstLefts3=function(n,r){for(var a,c,f=0,g=this.m_PolyOuts.length;f<g;f++)a=this.m_PolyOuts[f],c=i.Clipper.ParseFirstLeft(a.FirstLeft),a.Pts!==null&&c===n&&(a.FirstLeft=r)},i.Clipper.ParseFirstLeft=function(n){for(;n!==null&&n.Pts===null;)n=n.FirstLeft;return n},i.Clipper.prototype.JoinCommonEdges=function(){for(var n=0,r=this.m_Joins.length;n<r;n++){var a=this.m_Joins[n],c=this.GetOutRec(a.OutPt1.Idx),f=this.GetOutRec(a.OutPt2.Idx);if(!(c.Pts===null||f.Pts===null)&&!(c.IsOpen||f.IsOpen)){var g;c===f?g=c:this.OutRec1RightOfOutRec2(c,f)?g=f:this.OutRec1RightOfOutRec2(f,c)?g=c:g=this.GetLowermostRec(c,f),this.JoinPoints(a,c,f)&&(c===f?(c.Pts=a.OutPt1,c.BottomPt=null,f=this.CreateOutRec(),f.Pts=a.OutPt2,this.UpdateOutPtIdxs(f),this.Poly2ContainsPoly1(f.Pts,c.Pts)?(f.IsHole=!c.IsHole,f.FirstLeft=c,this.m_UsingPolyTree&&this.FixupFirstLefts2(f,c),(f.IsHole^this.ReverseSolution)==this.Area$1(f)>0&&this.ReversePolyPtLinks(f.Pts)):this.Poly2ContainsPoly1(c.Pts,f.Pts)?(f.IsHole=c.IsHole,c.IsHole=!f.IsHole,f.FirstLeft=c.FirstLeft,c.FirstLeft=f,this.m_UsingPolyTree&&this.FixupFirstLefts2(c,f),(c.IsHole^this.ReverseSolution)==this.Area$1(c)>0&&this.ReversePolyPtLinks(c.Pts)):(f.IsHole=c.IsHole,f.FirstLeft=c.FirstLeft,this.m_UsingPolyTree&&this.FixupFirstLefts1(c,f))):(f.Pts=null,f.BottomPt=null,f.Idx=c.Idx,c.IsHole=g.IsHole,g===f&&(c.FirstLeft=f.FirstLeft),f.FirstLeft=c,this.m_UsingPolyTree&&this.FixupFirstLefts3(f,c)))}}},i.Clipper.prototype.UpdateOutPtIdxs=function(n){var r=n.Pts;do r.Idx=n.Idx,r=r.Prev;while(r!==n.Pts)},i.Clipper.prototype.DoSimplePolygons=function(){for(var n=0;n<this.m_PolyOuts.length;){var r=this.m_PolyOuts[n++],a=r.Pts;if(!(a===null||r.IsOpen))do{for(var c=a.Next;c!==r.Pts;){if(i.IntPoint.op_Equality(a.Pt,c.Pt)&&c.Next!==a&&c.Prev!==a){var f=a.Prev,g=c.Prev;a.Prev=g,g.Next=a,c.Prev=f,f.Next=c,r.Pts=a;var x=this.CreateOutRec();x.Pts=c,this.UpdateOutPtIdxs(x),this.Poly2ContainsPoly1(x.Pts,r.Pts)?(x.IsHole=!r.IsHole,x.FirstLeft=r,this.m_UsingPolyTree&&this.FixupFirstLefts2(x,r)):this.Poly2ContainsPoly1(r.Pts,x.Pts)?(x.IsHole=r.IsHole,r.IsHole=!x.IsHole,x.FirstLeft=r.FirstLeft,r.FirstLeft=x,this.m_UsingPolyTree&&this.FixupFirstLefts2(r,x)):(x.IsHole=r.IsHole,x.FirstLeft=r.FirstLeft,this.m_UsingPolyTree&&this.FixupFirstLefts1(r,x)),c=a}c=c.Next}a=a.Next}while(a!==r.Pts)}},i.Clipper.Area=function(n){if(!Array.isArray(n))return 0;var r=n.length;if(r<3)return 0;for(var a=0,c=0,f=r-1;c<r;++c)a+=(n[f].X+n[c].X)*(n[f].Y-n[c].Y),f=c;return-a*.5},i.Clipper.prototype.Area=function(n){var r=n;if(n===null)return 0;var a=0;do a=a+(n.Prev.Pt.X+n.Pt.X)*(n.Prev.Pt.Y-n.Pt.Y),n=n.Next;while(n!==r);return a*.5},i.Clipper.prototype.Area$1=function(n){return this.Area(n.Pts)},i.Clipper.SimplifyPolygon=function(n,r){var a=new Array,c=new i.Clipper(0);return c.StrictlySimple=!0,c.AddPath(n,i.PolyType.ptSubject,!0),c.Execute(i.ClipType.ctUnion,a,r,r),a},i.Clipper.SimplifyPolygons=function(n,r){typeof r>"u"&&(r=i.PolyFillType.pftEvenOdd);var a=new Array,c=new i.Clipper(0);return c.StrictlySimple=!0,c.AddPaths(n,i.PolyType.ptSubject,!0),c.Execute(i.ClipType.ctUnion,a,r,r),a},i.Clipper.DistanceSqrd=function(n,r){var a=n.X-r.X,c=n.Y-r.Y;return a*a+c*c},i.Clipper.DistanceFromLineSqrd=function(n,r,a){var c=r.Y-a.Y,f=a.X-r.X,g=c*r.X+f*r.Y;return g=c*n.X+f*n.Y-g,g*g/(c*c+f*f)},i.Clipper.SlopesNearCollinear=function(n,r,a,c){return Math.abs(n.X-r.X)>Math.abs(n.Y-r.Y)?n.X>r.X==n.X<a.X?i.Clipper.DistanceFromLineSqrd(n,r,a)<c:r.X>n.X==r.X<a.X?i.Clipper.DistanceFromLineSqrd(r,n,a)<c:i.Clipper.DistanceFromLineSqrd(a,n,r)<c:n.Y>r.Y==n.Y<a.Y?i.Clipper.DistanceFromLineSqrd(n,r,a)<c:r.Y>n.Y==r.Y<a.Y?i.Clipper.DistanceFromLineSqrd(r,n,a)<c:i.Clipper.DistanceFromLineSqrd(a,n,r)<c},i.Clipper.PointsAreClose=function(n,r,a){var c=n.X-r.X,f=n.Y-r.Y;return c*c+f*f<=a},i.Clipper.ExcludeOp=function(n){var r=n.Prev;return r.Next=n.Next,n.Next.Prev=r,r.Idx=0,r},i.Clipper.CleanPolygon=function(n,r){typeof r>"u"&&(r=1.415);var a=n.length;if(a===0)return new Array;for(var c=new Array(a),f=0;f<a;++f)c[f]=new i.OutPt;for(var f=0;f<a;++f)c[f].Pt=n[f],c[f].Next=c[(f+1)%a],c[f].Next.Prev=c[f],c[f].Idx=0;for(var g=r*r,x=c[0];x.Idx===0&&x.Next!==x.Prev;)i.Clipper.PointsAreClose(x.Pt,x.Prev.Pt,g)?(x=i.Clipper.ExcludeOp(x),a--):i.Clipper.PointsAreClose(x.Prev.Pt,x.Next.Pt,g)?(i.Clipper.ExcludeOp(x.Next),x=i.Clipper.ExcludeOp(x),a-=2):i.Clipper.SlopesNearCollinear(x.Prev.Pt,x.Pt,x.Next.Pt,g)?(x=i.Clipper.ExcludeOp(x),a--):(x.Idx=1,x=x.Next);a<3&&(a=0);for(var M=new Array(a),f=0;f<a;++f)M[f]=new i.IntPoint1(x.Pt),x=x.Next;return c=null,M},i.Clipper.CleanPolygons=function(n,r){for(var a=new Array(n.length),c=0,f=n.length;c<f;c++)a[c]=i.Clipper.CleanPolygon(n[c],r);return a},i.Clipper.Minkowski=function(n,r,a,c){var f=c?1:0,g=n.length,x=r.length,M=new Array;if(a)for(var b=0;b<x;b++){for(var w=new Array(g),L=0,R=n.length,F=n[L];L<R;L++,F=n[L])w[L]=new i.IntPoint2(r[b].X+F.X,r[b].Y+F.Y);M.push(w)}else for(var b=0;b<x;b++){for(var w=new Array(g),L=0,R=n.length,F=n[L];L<R;L++,F=n[L])w[L]=new i.IntPoint2(r[b].X-F.X,r[b].Y-F.Y);M.push(w)}for(var G=new Array,b=0;b<x-1+f;b++)for(var L=0;L<g;L++){var J=new Array;J.push(M[b%x][L%g]),J.push(M[(b+1)%x][L%g]),J.push(M[(b+1)%x][(L+1)%g]),J.push(M[b%x][(L+1)%g]),i.Clipper.Orientation(J)||J.reverse(),G.push(J)}return G},i.Clipper.MinkowskiSum=function(n,r,a){if(r[0]instanceof Array){for(var f=r,x=new i.Paths,g=new i.Clipper,M=0;M<f.length;++M){var b=i.Clipper.Minkowski(n,f[M],!0,a);if(g.AddPaths(b,i.PolyType.ptSubject,!0),a){var c=i.Clipper.TranslatePath(f[M],n[0]);g.AddPath(c,i.PolyType.ptClip,!0)}}return g.Execute(i.ClipType.ctUnion,x,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),x}else{var c=r,f=i.Clipper.Minkowski(n,c,!0,a),g=new i.Clipper;return g.AddPaths(f,i.PolyType.ptSubject,!0),g.Execute(i.ClipType.ctUnion,f,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),f}},i.Clipper.TranslatePath=function(n,r){for(var a=new i.Path,c=0;c<n.length;c++)a.push(new i.IntPoint2(n[c].X+r.X,n[c].Y+r.Y));return a},i.Clipper.MinkowskiDiff=function(n,r){var a=i.Clipper.Minkowski(n,r,!1,!0),c=new i.Clipper;return c.AddPaths(a,i.PolyType.ptSubject,!0),c.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNonZero,i.PolyFillType.pftNonZero),a},i.Clipper.PolyTreeToPaths=function(n){var r=new Array;return i.Clipper.AddPolyNodeToPaths(n,i.Clipper.NodeType.ntAny,r),r},i.Clipper.AddPolyNodeToPaths=function(n,r,a){var c=!0;switch(r){case i.Clipper.NodeType.ntOpen:return;case i.Clipper.NodeType.ntClosed:c=!n.IsOpen;break;default:break}n.m_polygon.length>0&&c&&a.push(n.m_polygon);for(var f=0,g=n.Childs(),x=g.length,M=g[f];f<x;f++,M=g[f])i.Clipper.AddPolyNodeToPaths(M,r,a)},i.Clipper.OpenPathsFromPolyTree=function(n){for(var r=new i.Paths,a=0,c=n.ChildCount();a<c;a++)n.Childs()[a].IsOpen&&r.push(n.Childs()[a].m_polygon);return r},i.Clipper.ClosedPathsFromPolyTree=function(n){var r=new i.Paths;return i.Clipper.AddPolyNodeToPaths(n,i.Clipper.NodeType.ntClosed,r),r},Fs(i.Clipper,i.ClipperBase),i.Clipper.NodeType={ntAny:0,ntOpen:1,ntClosed:2},i.ClipperOffset=function(n,r){typeof n>"u"&&(n=2),typeof r>"u"&&(r=i.ClipperOffset.def_arc_tolerance),this.m_destPolys=new i.Paths,this.m_srcPoly=new i.Path,this.m_destPoly=new i.Path,this.m_normals=new Array,this.m_delta=0,this.m_sinA=0,this.m_sin=0,this.m_cos=0,this.m_miterLim=0,this.m_StepsPerRad=0,this.m_lowest=new i.IntPoint0,this.m_polyNodes=new i.PolyNode,this.MiterLimit=n,this.ArcTolerance=r,this.m_lowest.X=-1},i.ClipperOffset.two_pi=6.28318530717959,i.ClipperOffset.def_arc_tolerance=.25,i.ClipperOffset.prototype.Clear=function(){i.Clear(this.m_polyNodes.Childs()),this.m_lowest.X=-1},i.ClipperOffset.Round=i.Clipper.Round,i.ClipperOffset.prototype.AddPath=function(n,r,a){var c=n.length-1;if(!(c<0)){var f=new i.PolyNode;if(f.m_jointype=r,f.m_endtype=a,a===i.EndType.etClosedLine||a===i.EndType.etClosedPolygon)for(;c>0&&i.IntPoint.op_Equality(n[0],n[c]);)c--;f.m_polygon.push(n[0]);for(var g=0,x=0,M=1;M<=c;M++)i.IntPoint.op_Inequality(f.m_polygon[g],n[M])&&(g++,f.m_polygon.push(n[M]),(n[M].Y>f.m_polygon[x].Y||n[M].Y===f.m_polygon[x].Y&&n[M].X<f.m_polygon[x].X)&&(x=g));if(!(a===i.EndType.etClosedPolygon&&g<2)&&(this.m_polyNodes.AddChild(f),a===i.EndType.etClosedPolygon))if(this.m_lowest.X<0)this.m_lowest=new i.IntPoint2(this.m_polyNodes.ChildCount()-1,x);else{var b=this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon[this.m_lowest.Y];(f.m_polygon[x].Y>b.Y||f.m_polygon[x].Y===b.Y&&f.m_polygon[x].X<b.X)&&(this.m_lowest=new i.IntPoint2(this.m_polyNodes.ChildCount()-1,x))}}},i.ClipperOffset.prototype.AddPaths=function(n,r,a){for(var c=0,f=n.length;c<f;c++)this.AddPath(n[c],r,a)},i.ClipperOffset.prototype.FixOrientations=function(){if(this.m_lowest.X>=0&&!i.Clipper.Orientation(this.m_polyNodes.Childs()[this.m_lowest.X].m_polygon))for(var n=0;n<this.m_polyNodes.ChildCount();n++){var r=this.m_polyNodes.Childs()[n];(r.m_endtype===i.EndType.etClosedPolygon||r.m_endtype===i.EndType.etClosedLine&&i.Clipper.Orientation(r.m_polygon))&&r.m_polygon.reverse()}else for(var n=0;n<this.m_polyNodes.ChildCount();n++){var r=this.m_polyNodes.Childs()[n];r.m_endtype===i.EndType.etClosedLine&&!i.Clipper.Orientation(r.m_polygon)&&r.m_polygon.reverse()}},i.ClipperOffset.GetUnitNormal=function(n,r){var a=r.X-n.X,c=r.Y-n.Y;if(a===0&&c===0)return new i.DoublePoint2(0,0);var f=1/Math.sqrt(a*a+c*c);return a*=f,c*=f,new i.DoublePoint2(c,-a)},i.ClipperOffset.prototype.DoOffset=function(n){if(this.m_destPolys=new Array,this.m_delta=n,i.ClipperBase.near_zero(n)){for(var r=0;r<this.m_polyNodes.ChildCount();r++){var a=this.m_polyNodes.Childs()[r];a.m_endtype===i.EndType.etClosedPolygon&&this.m_destPolys.push(a.m_polygon)}return}this.MiterLimit>2?this.m_miterLim=2/(this.MiterLimit*this.MiterLimit):this.m_miterLim=.5;var c;this.ArcTolerance<=0?c=i.ClipperOffset.def_arc_tolerance:this.ArcTolerance>Math.abs(n)*i.ClipperOffset.def_arc_tolerance?c=Math.abs(n)*i.ClipperOffset.def_arc_tolerance:c=this.ArcTolerance;var f=3.14159265358979/Math.acos(1-c/Math.abs(n));this.m_sin=Math.sin(i.ClipperOffset.two_pi/f),this.m_cos=Math.cos(i.ClipperOffset.two_pi/f),this.m_StepsPerRad=f/i.ClipperOffset.two_pi,n<0&&(this.m_sin=-this.m_sin);for(var r=0;r<this.m_polyNodes.ChildCount();r++){var a=this.m_polyNodes.Childs()[r];this.m_srcPoly=a.m_polygon;var g=this.m_srcPoly.length;if(!(g===0||n<=0&&(g<3||a.m_endtype!==i.EndType.etClosedPolygon))){if(this.m_destPoly=new Array,g===1){if(a.m_jointype===i.JoinType.jtRound)for(var x=1,M=0,b=1;b<=f;b++){this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+x*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+M*n)));var w=x;x=x*this.m_cos-this.m_sin*M,M=w*this.m_sin+M*this.m_cos}else for(var x=-1,M=-1,b=0;b<4;++b)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+x*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+M*n))),x<0?x=1:M<0?M=1:x=-1;this.m_destPolys.push(this.m_destPoly);continue}this.m_normals.length=0;for(var b=0;b<g-1;b++)this.m_normals.push(i.ClipperOffset.GetUnitNormal(this.m_srcPoly[b],this.m_srcPoly[b+1]));if(a.m_endtype===i.EndType.etClosedLine||a.m_endtype===i.EndType.etClosedPolygon?this.m_normals.push(i.ClipperOffset.GetUnitNormal(this.m_srcPoly[g-1],this.m_srcPoly[0])):this.m_normals.push(new i.DoublePoint1(this.m_normals[g-2])),a.m_endtype===i.EndType.etClosedPolygon){for(var L=g-1,b=0;b<g;b++)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly)}else if(a.m_endtype===i.EndType.etClosedLine){for(var L=g-1,b=0;b<g;b++)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly),this.m_destPoly=new Array;for(var R=this.m_normals[g-1],b=g-1;b>0;b--)this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b-1].X,-this.m_normals[b-1].Y);this.m_normals[0]=new i.DoublePoint2(-R.X,-R.Y),L=0;for(var b=g-1;b>=0;b--)L=this.OffsetPoint(b,L,a.m_jointype);this.m_destPolys.push(this.m_destPoly)}else{for(var L=0,b=1;b<g-1;++b)L=this.OffsetPoint(b,L,a.m_jointype);var F;if(a.m_endtype===i.EndType.etOpenButt){var b=g-1;F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[b].X+this.m_normals[b].X*n),i.ClipperOffset.Round(this.m_srcPoly[b].Y+this.m_normals[b].Y*n)),this.m_destPoly.push(F),F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[b].X-this.m_normals[b].X*n),i.ClipperOffset.Round(this.m_srcPoly[b].Y-this.m_normals[b].Y*n)),this.m_destPoly.push(F)}else{var b=g-1;L=g-2,this.m_sinA=0,this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b].X,-this.m_normals[b].Y),a.m_endtype===i.EndType.etOpenSquare?this.DoSquare(b,L):this.DoRound(b,L)}for(var b=g-1;b>0;b--)this.m_normals[b]=new i.DoublePoint2(-this.m_normals[b-1].X,-this.m_normals[b-1].Y);this.m_normals[0]=new i.DoublePoint2(-this.m_normals[1].X,-this.m_normals[1].Y),L=g-1;for(var b=L-1;b>0;--b)L=this.OffsetPoint(b,L,a.m_jointype);a.m_endtype===i.EndType.etOpenButt?(F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X-this.m_normals[0].X*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y-this.m_normals[0].Y*n)),this.m_destPoly.push(F),F=new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[0].X+this.m_normals[0].X*n),i.ClipperOffset.Round(this.m_srcPoly[0].Y+this.m_normals[0].Y*n)),this.m_destPoly.push(F)):(L=1,this.m_sinA=0,a.m_endtype===i.EndType.etOpenSquare?this.DoSquare(0,1):this.DoRound(0,1)),this.m_destPolys.push(this.m_destPoly)}}}},i.ClipperOffset.prototype.Execute=function(){var n=arguments,r=n[0]instanceof i.PolyTree;if(r){var a=n[0],c=n[1];a.Clear(),this.FixOrientations(),this.DoOffset(c);var f=new i.Clipper(0);if(f.AddPaths(this.m_destPolys,i.PolyType.ptSubject,!0),c>0)f.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftPositive,i.PolyFillType.pftPositive);else{var g=i.Clipper.GetBounds(this.m_destPolys),x=new i.Path;if(x.push(new i.IntPoint2(g.left-10,g.bottom+10)),x.push(new i.IntPoint2(g.right+10,g.bottom+10)),x.push(new i.IntPoint2(g.right+10,g.top-10)),x.push(new i.IntPoint2(g.left-10,g.top-10)),f.AddPath(x,i.PolyType.ptSubject,!0),f.ReverseSolution=!0,f.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNegative,i.PolyFillType.pftNegative),a.ChildCount()===1&&a.Childs()[0].ChildCount()>0){var M=a.Childs()[0];a.Childs()[0]=M.Childs()[0],a.Childs()[0].m_Parent=a;for(var b=1;b<M.ChildCount();b++)a.AddChild(M.Childs()[b])}else a.Clear()}}else{var a=n[0],c=n[1];i.Clear(a),this.FixOrientations(),this.DoOffset(c);var f=new i.Clipper(0);if(f.AddPaths(this.m_destPolys,i.PolyType.ptSubject,!0),c>0)f.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftPositive,i.PolyFillType.pftPositive);else{var g=i.Clipper.GetBounds(this.m_destPolys),x=new i.Path;x.push(new i.IntPoint2(g.left-10,g.bottom+10)),x.push(new i.IntPoint2(g.right+10,g.bottom+10)),x.push(new i.IntPoint2(g.right+10,g.top-10)),x.push(new i.IntPoint2(g.left-10,g.top-10)),f.AddPath(x,i.PolyType.ptSubject,!0),f.ReverseSolution=!0,f.Execute(i.ClipType.ctUnion,a,i.PolyFillType.pftNegative,i.PolyFillType.pftNegative),a.length>0&&a.splice(0,1)}}},i.ClipperOffset.prototype.OffsetPoint=function(n,r,a){if(this.m_sinA=this.m_normals[r].X*this.m_normals[n].Y-this.m_normals[n].X*this.m_normals[r].Y,Math.abs(this.m_sinA*this.m_delta)<1){var c=this.m_normals[r].X*this.m_normals[n].X+this.m_normals[n].Y*this.m_normals[r].Y;if(c>0)return this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[r].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[r].Y*this.m_delta))),r}else this.m_sinA>1?this.m_sinA=1:this.m_sinA<-1&&(this.m_sinA=-1);if(this.m_sinA*this.m_delta<0)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[r].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[r].Y*this.m_delta))),this.m_destPoly.push(new i.IntPoint1(this.m_srcPoly[n])),this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[n].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[n].Y*this.m_delta)));else switch(a){case i.JoinType.jtMiter:{var f=1+(this.m_normals[n].X*this.m_normals[r].X+this.m_normals[n].Y*this.m_normals[r].Y);f>=this.m_miterLim?this.DoMiter(n,r,f):this.DoSquare(n,r);break}case i.JoinType.jtSquare:this.DoSquare(n,r);break;case i.JoinType.jtRound:this.DoRound(n,r);break}return r=n,r},i.ClipperOffset.prototype.DoSquare=function(n,r){var a=Math.tan(Math.atan2(this.m_sinA,this.m_normals[r].X*this.m_normals[n].X+this.m_normals[r].Y*this.m_normals[n].Y)/4);this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_delta*(this.m_normals[r].X-this.m_normals[r].Y*a)),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_delta*(this.m_normals[r].Y+this.m_normals[r].X*a)))),this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_delta*(this.m_normals[n].X+this.m_normals[n].Y*a)),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_delta*(this.m_normals[n].Y-this.m_normals[n].X*a))))},i.ClipperOffset.prototype.DoMiter=function(n,r,a){var c=this.m_delta/a;this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+(this.m_normals[r].X+this.m_normals[n].X)*c),i.ClipperOffset.Round(this.m_srcPoly[n].Y+(this.m_normals[r].Y+this.m_normals[n].Y)*c)))},i.ClipperOffset.prototype.DoRound=function(n,r){for(var a=Math.atan2(this.m_sinA,this.m_normals[r].X*this.m_normals[n].X+this.m_normals[r].Y*this.m_normals[n].Y),c=Math.max(i.Cast_Int32(i.ClipperOffset.Round(this.m_StepsPerRad*Math.abs(a))),1),f=this.m_normals[r].X,g=this.m_normals[r].Y,x,M=0;M<c;++M)this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+f*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+g*this.m_delta))),x=f,f=f*this.m_cos-this.m_sin*g,g=x*this.m_sin+g*this.m_cos;this.m_destPoly.push(new i.IntPoint2(i.ClipperOffset.Round(this.m_srcPoly[n].X+this.m_normals[n].X*this.m_delta),i.ClipperOffset.Round(this.m_srcPoly[n].Y+this.m_normals[n].Y*this.m_delta)))},i.Error=function(n){try{throw new Error(n)}catch(r){alert(r.message)}},i.JS={},i.JS.AreaOfPolygon=function(n,r){return r||(r=1),i.Clipper.Area(n)/(r*r)},i.JS.AreaOfPolygons=function(n,r){r||(r=1);for(var a=0,c=0;c<n.length;c++)a+=i.Clipper.Area(n[c]);return a/(r*r)},i.JS.BoundsOfPath=function(n,r){return i.JS.BoundsOfPaths([n],r)},i.JS.BoundsOfPaths=function(n,r){r||(r=1);var a=i.Clipper.GetBounds(n);return a.left/=r,a.bottom/=r,a.right/=r,a.top/=r,a},i.JS.Clean=function(c,r){if(!(c instanceof Array))return[];var a=c[0]instanceof Array,c=i.JS.Clone(c);if(typeof r!="number"||r===null)return i.Error("Delta is not a number in Clean()."),c;if(c.length===0||c.length===1&&c[0].length===0||r<0)return c;a||(c=[c]);for(var f=c.length,g,x,M,b,w,L,R,F=[],G=0;G<f;G++)if(x=c[G],g=x.length,g!==0){if(g<3){M=x,F.push(M);continue}for(M=x,b=r*r,w=x[0],L=1,R=1;R<g;R++)(x[R].X-w.X)*(x[R].X-w.X)+(x[R].Y-w.Y)*(x[R].Y-w.Y)<=b||(M[L]=x[R],w=x[R],L++);w=x[L-1],(x[0].X-w.X)*(x[0].X-w.X)+(x[0].Y-w.Y)*(x[0].Y-w.Y)<=b&&L--,L<g&&M.splice(L,g-L),M.length&&F.push(M)}return!a&&F.length?F=F[0]:!a&&F.length===0?F=[]:a&&F.length===0&&(F=[[]]),F},i.JS.Clone=function(n){if(!(n instanceof Array))return[];if(n.length===0)return[];if(n.length===1&&n[0].length===0)return[[]];var r=n[0]instanceof Array;r||(n=[n]);var a=n.length,c,f,g,x,M=new Array(a);for(f=0;f<a;f++){for(c=n[f].length,x=new Array(c),g=0;g<c;g++)x[g]={X:n[f][g].X,Y:n[f][g].Y};M[f]=x}return r||(M=M[0]),M},i.JS.Lighten=function(n,r){if(!(n instanceof Array))return[];if(typeof r!="number"||r===null)return i.Error("Tolerance is not a number in Lighten()."),i.JS.Clone(n);if(n.length===0||n.length===1&&n[0].length===0||r<0)return i.JS.Clone(n);var a=n[0]instanceof Array;a||(n=[n]);var c,f,g,x,M,b,w,L,R,F,G,J,$,et,xt,Bt,Me,ha=n.length,ua=r*r,be=[];for(c=0;c<ha;c++)if(g=n[c],b=g.length,b!==0){for(x=0;x<1e6;x++){for(M=[],b=g.length,g[b-1].X!==g[0].X||g[b-1].Y!==g[0].Y?(J=1,g.push({X:g[0].X,Y:g[0].Y}),b=g.length):J=0,G=[],f=0;f<b-2;f++)w=g[f],R=g[f+1],L=g[f+2],Bt=w.X,Me=w.Y,$=L.X-Bt,et=L.Y-Me,($!==0||et!==0)&&(xt=((R.X-Bt)*$+(R.Y-Me)*et)/($*$+et*et),xt>1?(Bt=L.X,Me=L.Y):xt>0&&(Bt+=$*xt,Me+=et*xt)),$=R.X-Bt,et=R.Y-Me,F=$*$+et*et,F<=ua&&(G[f+1]=1,f++);for(M.push({X:g[0].X,Y:g[0].Y}),f=1;f<b-1;f++)G[f]||M.push({X:g[f].X,Y:g[f].Y});if(M.push({X:g[b-1].X,Y:g[b-1].Y}),J&&g.pop(),G.length)g=M;else break}b=M.length,M[b-1].X===M[0].X&&M[b-1].Y===M[0].Y&&M.pop(),M.length>2&&be.push(M)}return a||(be=be[0]),typeof be>"u"&&(be=[]),be},i.JS.PerimeterOfPath=function(n,r,a){if(typeof n>"u")return 0;var c=Math.sqrt,f=0,g,x,M=0,b=0,w=0,L=0,R=n.length;if(R<2)return 0;for(r&&(n[R]=n[0],R++);--R;)g=n[R],M=g.X,b=g.Y,x=n[R-1],w=x.X,L=x.Y,f+=c((M-w)*(M-w)+(b-L)*(b-L));return r&&n.pop(),f/a},i.JS.PerimeterOfPaths=function(n,r,a){a||(a=1);for(var c=0,f=0;f<n.length;f++)c+=i.JS.PerimeterOfPath(n[f],r,a);return c},i.JS.ScaleDownPath=function(n,r){var a,c;for(r||(r=1),a=n.length;a--;)c=n[a],c.X=c.X/r,c.Y=c.Y/r},i.JS.ScaleDownPaths=function(n,r){var a,c,f;for(r||(r=1),a=n.length;a--;)for(c=n[a].length;c--;)f=n[a][c],f.X=f.X/r,f.Y=f.Y/r},i.JS.ScaleUpPath=function(n,r){var a,c,f=Math.round;for(r||(r=1),a=n.length;a--;)c=n[a],c.X=f(c.X*r),c.Y=f(c.Y*r)},i.JS.ScaleUpPaths=function(n,r){var a,c,f,g=Math.round;for(r||(r=1),a=n.length;a--;)for(c=n[a].length;c--;)f=n[a][c],f.X=g(f.X*r),f.Y=g(f.Y*r)},i.ExPolygons=function(){return[]},i.ExPolygon=function(){this.outer=null,this.holes=null},i.JS.AddOuterPolyNodeToExPolygons=function(n,r){var a=new i.ExPolygon;a.outer=n.Contour();var c=n.Childs(),f=c.length;a.holes=new Array(f);var g,x,M,b,w,L;for(M=0;M<f;M++)for(g=c[M],a.holes[M]=g.Contour(),b=0,w=g.Childs(),L=w.length;b<L;b++)x=w[b],i.JS.AddOuterPolyNodeToExPolygons(x,r);r.push(a)},i.JS.ExPolygonsToPaths=function(n){var r,a,c,f,g=new i.Paths;for(r=0,c=n.length;r<c;r++)for(g.push(n[r].outer),a=0,f=n[r].holes.length;a<f;a++)g.push(n[r].holes[a]);return g},i.JS.PolyTreeToExPolygons=function(n){var r=new i.ExPolygons,a,c,f,g;for(c=0,f=n.Childs(),g=f.length;c<g;c++)a=f[c],i.JS.AddOuterPolyNodeToExPolygons(a,r);return r}})()});var lr=1;var cr=3,gi=0,hr=1;var ur=1;var fr=100;var dr=204,pr=205;var Zi=0,Ji=1,$i=2,Wn=3,Ki=4,Qi=5,ji=6,ts=7,gs=0,mr=1,gr=2;var _s=1,xs=2,ys=3,vs=4,Ss=5,Ms=6,bs=7;var Ts=300,_r=301,Es=302;var xr=306,es=1e3,tn=1001,ns=1002;var yr=1006;var vr=1008;var Sr=1009;var Mr=1015;var br=1023;var on=2300,Yn=2301,Hn=2302,is=2303,ss=2400,rs=2401,os=2402;var As="",Pt="srgb",as="srgb-linear",ls="linear",Gn="srgb";var Xn=7680;var Tr=519;var Er=35044;var en=2e3,cs=2001;function ya(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function va(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function hs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}var Bs={},qn=null;function Ar(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function at(...i){i=Ar(i);let t="THREE."+i.shift();if(qn)qn("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function it(...i){i=Ar(i);let t="THREE."+i.shift();if(qn)qn("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function Oe(...i){let t=i.join(" ");t in Bs||(Bs[t]=!0,at(...i))}var Sa={[Zi]:Ji,[$i]:ji,[Ki]:ts,[Wn]:Qi,[Ji]:Zi,[ji]:$i,[ts]:Ki,[Qi]:Wn},ne=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let s=this._listeners;s[t]===void 0&&(s[t]=[]),s[t].indexOf(e)===-1&&s[t].push(e)}hasEventListener(t,e){let s=this._listeners;return s===void 0?!1:s[t]!==void 0&&s[t].indexOf(e)!==-1}removeEventListener(t,e){let s=this._listeners;if(s===void 0)return;let o=s[t];if(o!==void 0){let l=o.indexOf(e);l!==-1&&o.splice(l,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let s=e[t.type];if(s!==void 0){t.target=this;let o=s.slice(0);for(let l=0,h=o.length;l<h;l++)o[l].call(this,t);t.target=null}}},dt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var wu=Math.PI/180,Ma=180/Math.PI;function We(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,s=Math.random()*4294967295|0;return(dt[i&255]+dt[i>>8&255]+dt[i>>16&255]+dt[i>>24&255]+"-"+dt[t&255]+dt[t>>8&255]+"-"+dt[t>>16&15|64]+dt[t>>24&255]+"-"+dt[e&63|128]+dt[e>>8&255]+"-"+dt[e>>16&255]+dt[e>>24&255]+dt[s&255]+dt[s>>8&255]+dt[s>>16&255]+dt[s>>24&255]).toLowerCase()}function K(i,t,e){return Math.max(t,Math.min(e,i))}function ba(i,t){return(i%t+t)%t}function Ti(i,t,e){return(1-e)*i+e*t}function Je(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function yt(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var k=class i{static{i.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,s=this.y,o=t.elements;return this.x=o[0]*e+o[3]*s+o[6],this.y=o[1]*e+o[4]*s+o[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=K(this.x,t.x,e.x),this.y=K(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=K(this.x,t,e),this.y=K(this.y,t,e),this}clampLength(t,e){let s=this.length();return this.divideScalar(s||1).multiplyScalar(K(s,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let s=this.dot(t)/e;return Math.acos(K(s,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,s=this.y-t.y;return e*e+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,s){return this.x=t.x+(e.x-t.x)*s,this.y=t.y+(e.y-t.y)*s,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let s=Math.cos(e),o=Math.sin(e),l=this.x-t.x,h=this.y-t.y;return this.x=l*s-h*o+t.x,this.y=l*o+h*s+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},qt=class{constructor(t=0,e=0,s=0,o=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=s,this._w=o}static slerpFlat(t,e,s,o,l,h,d){let u=s[o+0],p=s[o+1],m=s[o+2],_=s[o+3],y=l[h+0],v=l[h+1],S=l[h+2],T=l[h+3];if(_!==T||u!==y||p!==v||m!==S){let A=u*y+p*v+m*S+_*T;A<0&&(y=-y,v=-v,S=-S,T=-T,A=-A);let P=1-d;if(A<.9995){let N=Math.acos(A),C=Math.sin(N);P=Math.sin(P*N)/C,d=Math.sin(d*N)/C,u=u*P+y*d,p=p*P+v*d,m=m*P+S*d,_=_*P+T*d}else{u=u*P+y*d,p=p*P+v*d,m=m*P+S*d,_=_*P+T*d;let N=1/Math.sqrt(u*u+p*p+m*m+_*_);u*=N,p*=N,m*=N,_*=N}}t[e]=u,t[e+1]=p,t[e+2]=m,t[e+3]=_}static multiplyQuaternionsFlat(t,e,s,o,l,h){let d=s[o],u=s[o+1],p=s[o+2],m=s[o+3],_=l[h],y=l[h+1],v=l[h+2],S=l[h+3];return t[e]=d*S+m*_+u*v-p*y,t[e+1]=u*S+m*y+p*_-d*v,t[e+2]=p*S+m*v+d*y-u*_,t[e+3]=m*S-d*_-u*y-p*v,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,s,o){return this._x=t,this._y=e,this._z=s,this._w=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let s=t._x,o=t._y,l=t._z,h=t._order,d=Math.cos,u=Math.sin,p=d(s/2),m=d(o/2),_=d(l/2),y=u(s/2),v=u(o/2),S=u(l/2);switch(h){case"XYZ":this._x=y*m*_+p*v*S,this._y=p*v*_-y*m*S,this._z=p*m*S+y*v*_,this._w=p*m*_-y*v*S;break;case"YXZ":this._x=y*m*_+p*v*S,this._y=p*v*_-y*m*S,this._z=p*m*S-y*v*_,this._w=p*m*_+y*v*S;break;case"ZXY":this._x=y*m*_-p*v*S,this._y=p*v*_+y*m*S,this._z=p*m*S+y*v*_,this._w=p*m*_-y*v*S;break;case"ZYX":this._x=y*m*_-p*v*S,this._y=p*v*_+y*m*S,this._z=p*m*S-y*v*_,this._w=p*m*_+y*v*S;break;case"YZX":this._x=y*m*_+p*v*S,this._y=p*v*_+y*m*S,this._z=p*m*S-y*v*_,this._w=p*m*_-y*v*S;break;case"XZY":this._x=y*m*_-p*v*S,this._y=p*v*_-y*m*S,this._z=p*m*S+y*v*_,this._w=p*m*_+y*v*S;break;default:at("Quaternion: .setFromEuler() encountered an unknown order: "+h)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let s=e/2,o=Math.sin(s);return this._x=t.x*o,this._y=t.y*o,this._z=t.z*o,this._w=Math.cos(s),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,s=e[0],o=e[4],l=e[8],h=e[1],d=e[5],u=e[9],p=e[2],m=e[6],_=e[10],y=s+d+_;if(y>0){let v=.5/Math.sqrt(y+1);this._w=.25/v,this._x=(m-u)*v,this._y=(l-p)*v,this._z=(h-o)*v}else if(s>d&&s>_){let v=2*Math.sqrt(1+s-d-_);this._w=(m-u)/v,this._x=.25*v,this._y=(o+h)/v,this._z=(l+p)/v}else if(d>_){let v=2*Math.sqrt(1+d-s-_);this._w=(l-p)/v,this._x=(o+h)/v,this._y=.25*v,this._z=(u+m)/v}else{let v=2*Math.sqrt(1+_-s-d);this._w=(h-o)/v,this._x=(l+p)/v,this._y=(u+m)/v,this._z=.25*v}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let s=t.dot(e)+1;return s<1e-8?(s=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=s):(this._x=0,this._y=-t.z,this._z=t.y,this._w=s)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=s),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(K(this.dot(t),-1,1)))}rotateTowards(t,e){let s=this.angleTo(t);if(s===0)return this;let o=Math.min(1,e/s);return this.slerp(t,o),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let s=t._x,o=t._y,l=t._z,h=t._w,d=e._x,u=e._y,p=e._z,m=e._w;return this._x=s*m+h*d+o*p-l*u,this._y=o*m+h*u+l*d-s*p,this._z=l*m+h*p+s*u-o*d,this._w=h*m-s*d-o*u-l*p,this._onChangeCallback(),this}slerp(t,e){let s=t._x,o=t._y,l=t._z,h=t._w,d=this.dot(t);d<0&&(s=-s,o=-o,l=-l,h=-h,d=-d);let u=1-e;if(d<.9995){let p=Math.acos(d),m=Math.sin(p);u=Math.sin(u*p)/m,e=Math.sin(e*p)/m,this._x=this._x*u+s*e,this._y=this._y*u+o*e,this._z=this._z*u+l*e,this._w=this._w*u+h*e,this._onChangeCallback()}else this._x=this._x*u+s*e,this._y=this._y*u+o*e,this._z=this._z*u+l*e,this._w=this._w*u+h*e,this.normalize();return this}slerpQuaternions(t,e,s){return this.copy(t).slerp(e,s)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),s=Math.random(),o=Math.sqrt(1-s),l=Math.sqrt(s);return this.set(o*Math.sin(t),o*Math.cos(t),l*Math.sin(e),l*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},E=class i{static{i.prototype.isVector3=!0}constructor(t=0,e=0,s=0){this.x=t,this.y=e,this.z=s}set(t,e,s){return s===void 0&&(s=this.z),this.x=t,this.y=e,this.z=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(zs.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(zs.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,s=this.y,o=this.z,l=t.elements;return this.x=l[0]*e+l[3]*s+l[6]*o,this.y=l[1]*e+l[4]*s+l[7]*o,this.z=l[2]*e+l[5]*s+l[8]*o,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,s=this.y,o=this.z,l=t.elements,h=1/(l[3]*e+l[7]*s+l[11]*o+l[15]);return this.x=(l[0]*e+l[4]*s+l[8]*o+l[12])*h,this.y=(l[1]*e+l[5]*s+l[9]*o+l[13])*h,this.z=(l[2]*e+l[6]*s+l[10]*o+l[14])*h,this}applyQuaternion(t){let e=this.x,s=this.y,o=this.z,l=t.x,h=t.y,d=t.z,u=t.w,p=2*(h*o-d*s),m=2*(d*e-l*o),_=2*(l*s-h*e);return this.x=e+u*p+h*_-d*m,this.y=s+u*m+d*p-l*_,this.z=o+u*_+l*m-h*p,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,s=this.y,o=this.z,l=t.elements;return this.x=l[0]*e+l[4]*s+l[8]*o,this.y=l[1]*e+l[5]*s+l[9]*o,this.z=l[2]*e+l[6]*s+l[10]*o,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=K(this.x,t.x,e.x),this.y=K(this.y,t.y,e.y),this.z=K(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=K(this.x,t,e),this.y=K(this.y,t,e),this.z=K(this.z,t,e),this}clampLength(t,e){let s=this.length();return this.divideScalar(s||1).multiplyScalar(K(s,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,s){return this.x=t.x+(e.x-t.x)*s,this.y=t.y+(e.y-t.y)*s,this.z=t.z+(e.z-t.z)*s,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let s=t.x,o=t.y,l=t.z,h=e.x,d=e.y,u=e.z;return this.x=o*u-l*d,this.y=l*h-s*u,this.z=s*d-o*h,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let s=t.dot(this)/e;return this.copy(t).multiplyScalar(s)}projectOnPlane(t){return Ei.copy(this).projectOnVector(t),this.sub(Ei)}reflect(t){return this.sub(Ei.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let s=this.dot(t)/e;return Math.acos(K(s,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,s=this.y-t.y,o=this.z-t.z;return e*e+s*s+o*o}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,s){let o=Math.sin(e)*t;return this.x=o*Math.sin(s),this.y=Math.cos(e)*t,this.z=o*Math.cos(s),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,s){return this.x=t*Math.sin(e),this.y=s,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),s=this.setFromMatrixColumn(t,1).length(),o=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=s,this.z=o,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,s=Math.sqrt(1-e*e);return this.x=s*Math.cos(t),this.y=e,this.z=s*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ei=new E,zs=new qt,q=class i{static{i.prototype.isMatrix3=!0}constructor(t,e,s,o,l,h,d,u,p){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,s,o,l,h,d,u,p)}set(t,e,s,o,l,h,d,u,p){let m=this.elements;return m[0]=t,m[1]=o,m[2]=d,m[3]=e,m[4]=l,m[5]=u,m[6]=s,m[7]=h,m[8]=p,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,s=t.elements;return e[0]=s[0],e[1]=s[1],e[2]=s[2],e[3]=s[3],e[4]=s[4],e[5]=s[5],e[6]=s[6],e[7]=s[7],e[8]=s[8],this}extractBasis(t,e,s){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),s.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let s=t.elements,o=e.elements,l=this.elements,h=s[0],d=s[3],u=s[6],p=s[1],m=s[4],_=s[7],y=s[2],v=s[5],S=s[8],T=o[0],A=o[3],P=o[6],N=o[1],C=o[4],I=o[7],D=o[2],B=o[5],z=o[8];return l[0]=h*T+d*N+u*D,l[3]=h*A+d*C+u*B,l[6]=h*P+d*I+u*z,l[1]=p*T+m*N+_*D,l[4]=p*A+m*C+_*B,l[7]=p*P+m*I+_*z,l[2]=y*T+v*N+S*D,l[5]=y*A+v*C+S*B,l[8]=y*P+v*I+S*z,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],s=t[1],o=t[2],l=t[3],h=t[4],d=t[5],u=t[6],p=t[7],m=t[8];return e*h*m-e*d*p-s*l*m+s*d*u+o*l*p-o*h*u}invert(){let t=this.elements,e=t[0],s=t[1],o=t[2],l=t[3],h=t[4],d=t[5],u=t[6],p=t[7],m=t[8],_=m*h-d*p,y=d*u-m*l,v=p*l-h*u,S=e*_+s*y+o*v;if(S===0)return this.set(0,0,0,0,0,0,0,0,0);let T=1/S;return t[0]=_*T,t[1]=(o*p-m*s)*T,t[2]=(d*s-o*h)*T,t[3]=y*T,t[4]=(m*e-o*u)*T,t[5]=(o*l-d*e)*T,t[6]=v*T,t[7]=(s*u-p*e)*T,t[8]=(h*e-s*l)*T,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,s,o,l,h,d){let u=Math.cos(l),p=Math.sin(l);return this.set(s*u,s*p,-s*(u*h+p*d)+h+t,-o*p,o*u,-o*(-p*h+u*d)+d+e,0,0,1),this}scale(t,e){return Oe("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Ai.makeScale(t,e)),this}rotate(t){return Oe("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Ai.makeRotation(-t)),this}translate(t,e){return Oe("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Ai.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),s=Math.sin(t);return this.set(e,-s,0,s,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,s=t.elements;for(let o=0;o<9;o++)if(e[o]!==s[o])return!1;return!0}fromArray(t,e=0){for(let s=0;s<9;s++)this.elements[s]=t[s+e];return this}toArray(t=[],e=0){let s=this.elements;return t[e]=s[0],t[e+1]=s[1],t[e+2]=s[2],t[e+3]=s[3],t[e+4]=s[4],t[e+5]=s[5],t[e+6]=s[6],t[e+7]=s[7],t[e+8]=s[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Ai=new q,Vs=new q().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ks=new q().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Ta(){let i={enabled:!0,workingColorSpace:as,spaces:{},convert:function(o,l,h){return this.enabled===!1||l===h||!l||!h||(this.spaces[l].transfer===Gn&&(o.r=Yt(o.r),o.g=Yt(o.g),o.b=Yt(o.b)),this.spaces[l].primaries!==this.spaces[h].primaries&&(o.applyMatrix3(this.spaces[l].toXYZ),o.applyMatrix3(this.spaces[h].fromXYZ)),this.spaces[h].transfer===Gn&&(o.r=Fe(o.r),o.g=Fe(o.g),o.b=Fe(o.b))),o},workingToColorSpace:function(o,l){return this.convert(o,this.workingColorSpace,l)},colorSpaceToWorking:function(o,l){return this.convert(o,l,this.workingColorSpace)},getPrimaries:function(o){return this.spaces[o].primaries},getTransfer:function(o){return o===As?ls:this.spaces[o].transfer},getToneMappingMode:function(o){return this.spaces[o].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(o,l=this.workingColorSpace){return o.fromArray(this.spaces[l].luminanceCoefficients)},define:function(o){Object.assign(this.spaces,o)},_getMatrix:function(o,l,h){return o.copy(this.spaces[l].toXYZ).multiply(this.spaces[h].fromXYZ)},_getDrawingBufferColorSpace:function(o){return this.spaces[o].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(o=this.workingColorSpace){return this.spaces[o].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(o,l){return Oe("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(o,l)},toWorkingColorSpace:function(o,l){return Oe("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(o,l)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],s=[.3127,.329];return i.define({[as]:{primaries:t,whitePoint:s,transfer:ls,toXYZ:Vs,fromXYZ:ks,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Pt},outputColorSpaceConfig:{drawingBufferColorSpace:Pt}},[Pt]:{primaries:t,whitePoint:s,transfer:Gn,toXYZ:Vs,fromXYZ:ks,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Pt}}}),i}var Ct=Ta();function Yt(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Fe(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Te,Zn=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let s;if(t instanceof HTMLCanvasElement)s=t;else{Te===void 0&&(Te=hs("canvas")),Te.width=t.width,Te.height=t.height;let o=Te.getContext("2d");t instanceof ImageData?o.putImageData(t,0,0):o.drawImage(t,0,0,t.width,t.height),s=Te}return s.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=hs("canvas");e.width=t.width,e.height=t.height;let s=e.getContext("2d");s.drawImage(t,0,0,t.width,t.height);let o=s.getImageData(0,0,t.width,t.height),l=o.data;for(let h=0;h<l.length;h++)l[h]=Yt(l[h]/255)*255;return s.putImageData(o,0,0),e}else if(t.data){let e=t.data.slice(0);for(let s=0;s<e.length;s++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[s]=Math.floor(Yt(e[s]/255)*255):e[s]=Yt(e[s]);return{data:e,width:t.width,height:t.height}}else return at("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Ea=0,Jn=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Ea++}),this.uuid=We(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let s={uuid:this.uuid,url:""},o=this.data;if(o!==null){let l;if(Array.isArray(o)){l=[];for(let h=0,d=o.length;h<d;h++)o[h].isDataTexture?l.push(wi(o[h].image)):l.push(wi(o[h]))}else l=wi(o);s.url=l}return e||(t.images[this.uuid]=s),s}};function wi(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Zn.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(at("Texture: Unable to serialize Texture."),{})}var Aa=0,Ci=new E,Ue=class i extends ne{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,s=tn,o=tn,l=yr,h=vr,d=br,u=Sr,p=i.DEFAULT_ANISOTROPY,m=As){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Aa++}),this.uuid=We(),this.name="",this.source=new Jn(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=s,this.wrapT=o,this.magFilter=l,this.minFilter=h,this.anisotropy=p,this.format=d,this.internalFormat=null,this.type=u,this.offset=new k(0,0),this.repeat=new k(1,1),this.center=new k(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new q,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=m,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ci).x}get height(){return this.source.getSize(Ci).y}get depth(){return this.source.getSize(Ci).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let s=t[e];if(s===void 0){at(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let o=this[e];if(o===void 0){at(`Texture.setValues(): property '${e}' does not exist.`);continue}o&&s&&o.isVector2&&s.isVector2||o&&s&&o.isVector3&&s.isVector3||o&&s&&o.isMatrix3&&s.isMatrix3?o.copy(s):this[e]=s}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let s={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(s.userData=this.userData),e||(t.textures[this.uuid]=s),s}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ts)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case es:t.x=t.x-Math.floor(t.x);break;case tn:t.x=t.x<0?0:1;break;case ns:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case es:t.y=t.y-Math.floor(t.y);break;case tn:t.y=t.y<0?0:1;break;case ns:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Ue.DEFAULT_IMAGE=null;Ue.DEFAULT_MAPPING=Ts;Ue.DEFAULT_ANISOTROPY=1;var Be=class i{static{i.prototype.isVector4=!0}constructor(t=0,e=0,s=0,o=1){this.x=t,this.y=e,this.z=s,this.w=o}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,s,o){return this.x=t,this.y=e,this.z=s,this.w=o,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,s=this.y,o=this.z,l=this.w,h=t.elements;return this.x=h[0]*e+h[4]*s+h[8]*o+h[12]*l,this.y=h[1]*e+h[5]*s+h[9]*o+h[13]*l,this.z=h[2]*e+h[6]*s+h[10]*o+h[14]*l,this.w=h[3]*e+h[7]*s+h[11]*o+h[15]*l,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,s,o,l,u=t.elements,p=u[0],m=u[4],_=u[8],y=u[1],v=u[5],S=u[9],T=u[2],A=u[6],P=u[10];if(Math.abs(m-y)<.01&&Math.abs(_-T)<.01&&Math.abs(S-A)<.01){if(Math.abs(m+y)<.1&&Math.abs(_+T)<.1&&Math.abs(S+A)<.1&&Math.abs(p+v+P-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let C=(p+1)/2,I=(v+1)/2,D=(P+1)/2,B=(m+y)/4,z=(_+T)/4,O=(S+A)/4;return C>I&&C>D?C<.01?(s=0,o=.707106781,l=.707106781):(s=Math.sqrt(C),o=B/s,l=z/s):I>D?I<.01?(s=.707106781,o=0,l=.707106781):(o=Math.sqrt(I),s=B/o,l=O/o):D<.01?(s=.707106781,o=.707106781,l=0):(l=Math.sqrt(D),s=z/l,o=O/l),this.set(s,o,l,e),this}let N=Math.sqrt((A-S)*(A-S)+(_-T)*(_-T)+(y-m)*(y-m));return Math.abs(N)<.001&&(N=1),this.x=(A-S)/N,this.y=(_-T)/N,this.z=(y-m)/N,this.w=Math.acos((p+v+P-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=K(this.x,t.x,e.x),this.y=K(this.y,t.y,e.y),this.z=K(this.z,t.z,e.z),this.w=K(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=K(this.x,t,e),this.y=K(this.y,t,e),this.z=K(this.z,t,e),this.w=K(this.w,t,e),this}clampLength(t,e){let s=this.length();return this.divideScalar(s||1).multiplyScalar(K(s,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,s){return this.x=t.x+(e.x-t.x)*s,this.y=t.y+(e.y-t.y)*s,this.z=t.z+(e.z-t.z)*s,this.w=t.w+(e.w-t.w)*s,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};var vt=class i{static{i.prototype.isMatrix4=!0}constructor(t,e,s,o,l,h,d,u,p,m,_,y,v,S,T,A){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,s,o,l,h,d,u,p,m,_,y,v,S,T,A)}set(t,e,s,o,l,h,d,u,p,m,_,y,v,S,T,A){let P=this.elements;return P[0]=t,P[4]=e,P[8]=s,P[12]=o,P[1]=l,P[5]=h,P[9]=d,P[13]=u,P[2]=p,P[6]=m,P[10]=_,P[14]=y,P[3]=v,P[7]=S,P[11]=T,P[15]=A,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,s=t.elements;return e[0]=s[0],e[1]=s[1],e[2]=s[2],e[3]=s[3],e[4]=s[4],e[5]=s[5],e[6]=s[6],e[7]=s[7],e[8]=s[8],e[9]=s[9],e[10]=s[10],e[11]=s[11],e[12]=s[12],e[13]=s[13],e[14]=s[14],e[15]=s[15],this}copyPosition(t){let e=this.elements,s=t.elements;return e[12]=s[12],e[13]=s[13],e[14]=s[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,s){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),s.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),s.setFromMatrixColumn(this,2),this)}makeBasis(t,e,s){return this.set(t.x,e.x,s.x,0,t.y,e.y,s.y,0,t.z,e.z,s.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,s=t.elements,o=1/Ee.setFromMatrixColumn(t,0).length(),l=1/Ee.setFromMatrixColumn(t,1).length(),h=1/Ee.setFromMatrixColumn(t,2).length();return e[0]=s[0]*o,e[1]=s[1]*o,e[2]=s[2]*o,e[3]=0,e[4]=s[4]*l,e[5]=s[5]*l,e[6]=s[6]*l,e[7]=0,e[8]=s[8]*h,e[9]=s[9]*h,e[10]=s[10]*h,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,s=t.x,o=t.y,l=t.z,h=Math.cos(s),d=Math.sin(s),u=Math.cos(o),p=Math.sin(o),m=Math.cos(l),_=Math.sin(l);if(t.order==="XYZ"){let y=h*m,v=h*_,S=d*m,T=d*_;e[0]=u*m,e[4]=-u*_,e[8]=p,e[1]=v+S*p,e[5]=y-T*p,e[9]=-d*u,e[2]=T-y*p,e[6]=S+v*p,e[10]=h*u}else if(t.order==="YXZ"){let y=u*m,v=u*_,S=p*m,T=p*_;e[0]=y+T*d,e[4]=S*d-v,e[8]=h*p,e[1]=h*_,e[5]=h*m,e[9]=-d,e[2]=v*d-S,e[6]=T+y*d,e[10]=h*u}else if(t.order==="ZXY"){let y=u*m,v=u*_,S=p*m,T=p*_;e[0]=y-T*d,e[4]=-h*_,e[8]=S+v*d,e[1]=v+S*d,e[5]=h*m,e[9]=T-y*d,e[2]=-h*p,e[6]=d,e[10]=h*u}else if(t.order==="ZYX"){let y=h*m,v=h*_,S=d*m,T=d*_;e[0]=u*m,e[4]=S*p-v,e[8]=y*p+T,e[1]=u*_,e[5]=T*p+y,e[9]=v*p-S,e[2]=-p,e[6]=d*u,e[10]=h*u}else if(t.order==="YZX"){let y=h*u,v=h*p,S=d*u,T=d*p;e[0]=u*m,e[4]=T-y*_,e[8]=S*_+v,e[1]=_,e[5]=h*m,e[9]=-d*m,e[2]=-p*m,e[6]=v*_+S,e[10]=y-T*_}else if(t.order==="XZY"){let y=h*u,v=h*p,S=d*u,T=d*p;e[0]=u*m,e[4]=-_,e[8]=p*m,e[1]=y*_+T,e[5]=h*m,e[9]=v*_-S,e[2]=S*_-v,e[6]=d*m,e[10]=T*_+y}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(wa,t,Ca)}lookAt(t,e,s){let o=this.elements;return bt.subVectors(t,e),bt.lengthSq()===0&&(bt.z=1),bt.normalize(),Kt.crossVectors(s,bt),Kt.lengthSq()===0&&(Math.abs(s.z)===1?bt.x+=1e-4:bt.z+=1e-4,bt.normalize(),Kt.crossVectors(s,bt)),Kt.normalize(),Tn.crossVectors(bt,Kt),o[0]=Kt.x,o[4]=Tn.x,o[8]=bt.x,o[1]=Kt.y,o[5]=Tn.y,o[9]=bt.y,o[2]=Kt.z,o[6]=Tn.z,o[10]=bt.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let s=t.elements,o=e.elements,l=this.elements,h=s[0],d=s[4],u=s[8],p=s[12],m=s[1],_=s[5],y=s[9],v=s[13],S=s[2],T=s[6],A=s[10],P=s[14],N=s[3],C=s[7],I=s[11],D=s[15],B=o[0],z=o[4],O=o[8],X=o[12],V=o[1],H=o[5],j=o[9],W=o[13],tt=o[2],Y=o[6],ct=o[10],ft=o[14],Mt=o[3],Ot=o[7],Ft=o[11],$t=o[15];return l[0]=h*B+d*V+u*tt+p*Mt,l[4]=h*z+d*H+u*Y+p*Ot,l[8]=h*O+d*j+u*ct+p*Ft,l[12]=h*X+d*W+u*ft+p*$t,l[1]=m*B+_*V+y*tt+v*Mt,l[5]=m*z+_*H+y*Y+v*Ot,l[9]=m*O+_*j+y*ct+v*Ft,l[13]=m*X+_*W+y*ft+v*$t,l[2]=S*B+T*V+A*tt+P*Mt,l[6]=S*z+T*H+A*Y+P*Ot,l[10]=S*O+T*j+A*ct+P*Ft,l[14]=S*X+T*W+A*ft+P*$t,l[3]=N*B+C*V+I*tt+D*Mt,l[7]=N*z+C*H+I*Y+D*Ot,l[11]=N*O+C*j+I*ct+D*Ft,l[15]=N*X+C*W+I*ft+D*$t,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],s=t[4],o=t[8],l=t[12],h=t[1],d=t[5],u=t[9],p=t[13],m=t[2],_=t[6],y=t[10],v=t[14],S=t[3],T=t[7],A=t[11],P=t[15],N=u*v-p*y,C=d*v-p*_,I=d*y-u*_,D=h*v-p*m,B=h*y-u*m,z=h*_-d*m;return e*(T*N-A*C+P*I)-s*(S*N-A*D+P*B)+o*(S*C-T*D+P*z)-l*(S*I-T*B+A*z)}determinantAffine(){let t=this.elements,e=t[0],s=t[4],o=t[8],l=t[1],h=t[5],d=t[9],u=t[2],p=t[6],m=t[10];return e*(h*m-d*p)-s*(l*m-d*u)+o*(l*p-h*u)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,s){let o=this.elements;return t.isVector3?(o[12]=t.x,o[13]=t.y,o[14]=t.z):(o[12]=t,o[13]=e,o[14]=s),this}invert(){let t=this.elements,e=t[0],s=t[1],o=t[2],l=t[3],h=t[4],d=t[5],u=t[6],p=t[7],m=t[8],_=t[9],y=t[10],v=t[11],S=t[12],T=t[13],A=t[14],P=t[15],N=e*d-s*h,C=e*u-o*h,I=e*p-l*h,D=s*u-o*d,B=s*p-l*d,z=o*p-l*u,O=m*T-_*S,X=m*A-y*S,V=m*P-v*S,H=_*A-y*T,j=_*P-v*T,W=y*P-v*A,tt=N*W-C*j+I*H+D*V-B*X+z*O;if(tt===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let Y=1/tt;return t[0]=(d*W-u*j+p*H)*Y,t[1]=(o*j-s*W-l*H)*Y,t[2]=(T*z-A*B+P*D)*Y,t[3]=(y*B-_*z-v*D)*Y,t[4]=(u*V-h*W-p*X)*Y,t[5]=(e*W-o*V+l*X)*Y,t[6]=(A*I-S*z-P*C)*Y,t[7]=(m*z-y*I+v*C)*Y,t[8]=(h*j-d*V+p*O)*Y,t[9]=(s*V-e*j-l*O)*Y,t[10]=(S*B-T*I+P*N)*Y,t[11]=(_*I-m*B-v*N)*Y,t[12]=(d*X-h*H-u*O)*Y,t[13]=(e*H-s*X+o*O)*Y,t[14]=(T*C-S*D-A*N)*Y,t[15]=(m*D-_*C+y*N)*Y,this}scale(t){let e=this.elements,s=t.x,o=t.y,l=t.z;return e[0]*=s,e[4]*=o,e[8]*=l,e[1]*=s,e[5]*=o,e[9]*=l,e[2]*=s,e[6]*=o,e[10]*=l,e[3]*=s,e[7]*=o,e[11]*=l,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],s=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],o=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,s,o))}makeTranslation(t,e,s){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,s,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),s=Math.sin(t);return this.set(1,0,0,0,0,e,-s,0,0,s,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),s=Math.sin(t);return this.set(e,0,s,0,0,1,0,0,-s,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),s=Math.sin(t);return this.set(e,-s,0,0,s,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let s=Math.cos(e),o=Math.sin(e),l=1-s,h=t.x,d=t.y,u=t.z,p=l*h,m=l*d;return this.set(p*h+s,p*d-o*u,p*u+o*d,0,p*d+o*u,m*d+s,m*u-o*h,0,p*u-o*d,m*u+o*h,l*u*u+s,0,0,0,0,1),this}makeScale(t,e,s){return this.set(t,0,0,0,0,e,0,0,0,0,s,0,0,0,0,1),this}makeShear(t,e,s,o,l,h){return this.set(1,s,l,0,t,1,h,0,e,o,1,0,0,0,0,1),this}compose(t,e,s){let o=this.elements,l=e._x,h=e._y,d=e._z,u=e._w,p=l+l,m=h+h,_=d+d,y=l*p,v=l*m,S=l*_,T=h*m,A=h*_,P=d*_,N=u*p,C=u*m,I=u*_,D=s.x,B=s.y,z=s.z;return o[0]=(1-(T+P))*D,o[1]=(v+I)*D,o[2]=(S-C)*D,o[3]=0,o[4]=(v-I)*B,o[5]=(1-(y+P))*B,o[6]=(A+N)*B,o[7]=0,o[8]=(S+C)*z,o[9]=(A-N)*z,o[10]=(1-(y+T))*z,o[11]=0,o[12]=t.x,o[13]=t.y,o[14]=t.z,o[15]=1,this}decompose(t,e,s){let o=this.elements;t.x=o[12],t.y=o[13],t.z=o[14];let l=this.determinantAffine();if(l===0)return s.set(1,1,1),e.identity(),this;let h=Ee.set(o[0],o[1],o[2]).length(),d=Ee.set(o[4],o[5],o[6]).length(),u=Ee.set(o[8],o[9],o[10]).length();l<0&&(h=-h),Lt.copy(this);let p=1/h,m=1/d,_=1/u;return Lt.elements[0]*=p,Lt.elements[1]*=p,Lt.elements[2]*=p,Lt.elements[4]*=m,Lt.elements[5]*=m,Lt.elements[6]*=m,Lt.elements[8]*=_,Lt.elements[9]*=_,Lt.elements[10]*=_,e.setFromRotationMatrix(Lt),s.x=h,s.y=d,s.z=u,this}makePerspective(t,e,s,o,l,h,d=en,u=!1){let p=this.elements,m=2*l/(e-t),_=2*l/(s-o),y=(e+t)/(e-t),v=(s+o)/(s-o),S,T;if(u)S=l/(h-l),T=h*l/(h-l);else if(d===en)S=-(h+l)/(h-l),T=-2*h*l/(h-l);else if(d===cs)S=-h/(h-l),T=-h*l/(h-l);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+d);return p[0]=m,p[4]=0,p[8]=y,p[12]=0,p[1]=0,p[5]=_,p[9]=v,p[13]=0,p[2]=0,p[6]=0,p[10]=S,p[14]=T,p[3]=0,p[7]=0,p[11]=-1,p[15]=0,this}makeOrthographic(t,e,s,o,l,h,d=en,u=!1){let p=this.elements,m=2/(e-t),_=2/(s-o),y=-(e+t)/(e-t),v=-(s+o)/(s-o),S,T;if(u)S=1/(h-l),T=h/(h-l);else if(d===en)S=-2/(h-l),T=-(h+l)/(h-l);else if(d===cs)S=-1/(h-l),T=-l/(h-l);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+d);return p[0]=m,p[4]=0,p[8]=0,p[12]=y,p[1]=0,p[5]=_,p[9]=0,p[13]=v,p[2]=0,p[6]=0,p[10]=S,p[14]=T,p[3]=0,p[7]=0,p[11]=0,p[15]=1,this}equals(t){let e=this.elements,s=t.elements;for(let o=0;o<16;o++)if(e[o]!==s[o])return!1;return!0}fromArray(t,e=0){for(let s=0;s<16;s++)this.elements[s]=t[s+e];return this}toArray(t=[],e=0){let s=this.elements;return t[e]=s[0],t[e+1]=s[1],t[e+2]=s[2],t[e+3]=s[3],t[e+4]=s[4],t[e+5]=s[5],t[e+6]=s[6],t[e+7]=s[7],t[e+8]=s[8],t[e+9]=s[9],t[e+10]=s[10],t[e+11]=s[11],t[e+12]=s[12],t[e+13]=s[13],t[e+14]=s[14],t[e+15]=s[15],t}},Ee=new E,Lt=new vt,wa=new E(0,0,0),Ca=new E(1,1,1),Kt=new E,Tn=new E,bt=new E,Hs=new vt,Gs=new qt,ze=class i{constructor(t=0,e=0,s=0,o=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=s,this._order=o}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,s,o=this._order){return this._x=t,this._y=e,this._z=s,this._order=o,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,s=!0){let o=t.elements,l=o[0],h=o[4],d=o[8],u=o[1],p=o[5],m=o[9],_=o[2],y=o[6],v=o[10];switch(e){case"XYZ":this._y=Math.asin(K(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(-m,v),this._z=Math.atan2(-h,l)):(this._x=Math.atan2(y,p),this._z=0);break;case"YXZ":this._x=Math.asin(-K(m,-1,1)),Math.abs(m)<.9999999?(this._y=Math.atan2(d,v),this._z=Math.atan2(u,p)):(this._y=Math.atan2(-_,l),this._z=0);break;case"ZXY":this._x=Math.asin(K(y,-1,1)),Math.abs(y)<.9999999?(this._y=Math.atan2(-_,v),this._z=Math.atan2(-h,p)):(this._y=0,this._z=Math.atan2(u,l));break;case"ZYX":this._y=Math.asin(-K(_,-1,1)),Math.abs(_)<.9999999?(this._x=Math.atan2(y,v),this._z=Math.atan2(u,l)):(this._x=0,this._z=Math.atan2(-h,p));break;case"YZX":this._z=Math.asin(K(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(-m,p),this._y=Math.atan2(-_,l)):(this._x=0,this._y=Math.atan2(d,v));break;case"XZY":this._z=Math.asin(-K(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(y,p),this._y=Math.atan2(d,l)):(this._x=Math.atan2(-m,v),this._y=0);break;default:at("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,s===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,s){return Hs.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Hs,e,s)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Gs.setFromEuler(this),this.setFromQuaternion(Gs,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ze.DEFAULT_ORDER="XYZ";var $n=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Pa=0,Xs=new E,Ae=new qt,kt=new vt,En=new E,$e=new E,Ia=new E,Ra=new qt,Ws=new E(1,0,0),Ys=new E(0,1,0),qs=new E(0,0,1),Zs={type:"added"},La={type:"removed"},we={type:"childadded",child:null},Pi={type:"childremoved",child:null},ie=class i extends ne{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Pa++}),this.uuid=We(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new E,e=new ze,s=new qt,o=new E(1,1,1);function l(){s.setFromEuler(e,!1)}function h(){e.setFromQuaternion(s,void 0,!1)}e._onChange(l),s._onChange(h),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:s},scale:{configurable:!0,enumerable:!0,value:o},modelViewMatrix:{value:new vt},normalMatrix:{value:new q}}),this.matrix=new vt,this.matrixWorld=new vt,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new $n,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Ae.setFromAxisAngle(t,e),this.quaternion.multiply(Ae),this}rotateOnWorldAxis(t,e){return Ae.setFromAxisAngle(t,e),this.quaternion.premultiply(Ae),this}rotateX(t){return this.rotateOnAxis(Ws,t)}rotateY(t){return this.rotateOnAxis(Ys,t)}rotateZ(t){return this.rotateOnAxis(qs,t)}translateOnAxis(t,e){return Xs.copy(t).applyQuaternion(this.quaternion),this.position.add(Xs.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ws,t)}translateY(t){return this.translateOnAxis(Ys,t)}translateZ(t){return this.translateOnAxis(qs,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(kt.copy(this.matrixWorld).invert())}lookAt(t,e,s){t.isVector3?En.copy(t):En.set(t,e,s);let o=this.parent;this.updateWorldMatrix(!0,!1),$e.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?kt.lookAt($e,En,this.up):kt.lookAt(En,$e,this.up),this.quaternion.setFromRotationMatrix(kt),o&&(kt.extractRotation(o.matrixWorld),Ae.setFromRotationMatrix(kt),this.quaternion.premultiply(Ae.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(it("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Zs),we.child=t,this.dispatchEvent(we),we.child=null):it("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let s=0;s<arguments.length;s++)this.remove(arguments[s]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(La),Pi.child=t,this.dispatchEvent(Pi),Pi.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),kt.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),kt.multiply(t.parent.matrixWorld)),t.applyMatrix4(kt),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Zs),we.child=t,this.dispatchEvent(we),we.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let s=0,o=this.children.length;s<o;s++){let h=this.children[s].getObjectByProperty(t,e);if(h!==void 0)return h}}getObjectsByProperty(t,e,s=[]){this[t]===e&&s.push(this);let o=this.children;for(let l=0,h=o.length;l<h;l++)o[l].getObjectsByProperty(t,e,s);return s}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose($e,t,Ia),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose($e,Ra,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let s=0,o=e.length;s<o;s++)e[s].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let s=0,o=e.length;s<o;s++)e[s].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,s=t.y,o=t.z,l=this.matrix.elements;l[12]+=e-l[0]*e-l[4]*s-l[8]*o,l[13]+=s-l[1]*e-l[5]*s-l[9]*o,l[14]+=o-l[2]*e-l[6]*s-l[10]*o}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let s=0,o=e.length;s<o;s++)e[s].updateMatrixWorld(t)}updateWorldMatrix(t,e,s=!1){let o=this.parent;if(t===!0&&o!==null&&o.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||s)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,s=!0),e===!0){let l=this.children;for(let h=0,d=l.length;h<d;h++)l[h].updateWorldMatrix(!1,!0,s)}}toJSON(t){let e=t===void 0||typeof t=="string",s={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},s.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let o={};o.uuid=this.uuid,o.type=this.type,o.name=this.name,o.castShadow=this.castShadow,o.receiveShadow=this.receiveShadow,o.visible=this.visible,o.frustumCulled=this.frustumCulled,o.renderOrder=this.renderOrder,o.static=this.static,o.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(o.userData=this.userData),o.layers=this.layers.mask,o.matrix=this.matrix.toArray(),o.up=this.up.toArray(),this.pivot!==null&&(o.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(o.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(o.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(o.type="InstancedMesh",o.count=this.count,o.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(o.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(o.type="BatchedMesh",o.perObjectFrustumCulled=this.perObjectFrustumCulled,o.sortObjects=this.sortObjects,o.drawRanges=this._drawRanges,o.reservedRanges=this._reservedRanges,o.geometryInfo=this._geometryInfo.map(d=>({...d,boundingBox:d.boundingBox?d.boundingBox.toJSON():void 0,boundingSphere:d.boundingSphere?d.boundingSphere.toJSON():void 0})),o.instanceInfo=this._instanceInfo.map(d=>({...d})),o.availableInstanceIds=this._availableInstanceIds.slice(),o.availableGeometryIds=this._availableGeometryIds.slice(),o.nextIndexStart=this._nextIndexStart,o.nextVertexStart=this._nextVertexStart,o.geometryCount=this._geometryCount,o.maxInstanceCount=this._maxInstanceCount,o.maxVertexCount=this._maxVertexCount,o.maxIndexCount=this._maxIndexCount,o.geometryInitialized=this._geometryInitialized,o.matricesTexture=this._matricesTexture.toJSON(t),o.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(o.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(o.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(o.boundingBox=this.boundingBox.toJSON()));function l(d,u){return d[u.uuid]===void 0&&(d[u.uuid]=u.toJSON(t)),u.uuid}if(this.isScene)this.background&&(this.background.isColor?o.background=this.background.toJSON():this.background.isTexture&&(o.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(o.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){o.geometry=l(t.geometries,this.geometry);let d=this.geometry.parameters;if(d!==void 0&&d.shapes!==void 0){let u=d.shapes;if(Array.isArray(u))for(let p=0,m=u.length;p<m;p++){let _=u[p];l(t.shapes,_)}else l(t.shapes,u)}}if(this.isSkinnedMesh&&(o.bindMode=this.bindMode,o.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(l(t.skeletons,this.skeleton),o.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let d=[];for(let u=0,p=this.material.length;u<p;u++)d.push(l(t.materials,this.material[u]));o.material=d}else o.material=l(t.materials,this.material);if(this.children.length>0){o.children=[];for(let d=0;d<this.children.length;d++)o.children.push(this.children[d].toJSON(t).object)}if(this.animations.length>0){o.animations=[];for(let d=0;d<this.animations.length;d++){let u=this.animations[d];o.animations.push(l(t.animations,u))}}if(e){let d=h(t.geometries),u=h(t.materials),p=h(t.textures),m=h(t.images),_=h(t.shapes),y=h(t.skeletons),v=h(t.animations),S=h(t.nodes);d.length>0&&(s.geometries=d),u.length>0&&(s.materials=u),p.length>0&&(s.textures=p),m.length>0&&(s.images=m),_.length>0&&(s.shapes=_),y.length>0&&(s.skeletons=y),v.length>0&&(s.animations=v),S.length>0&&(s.nodes=S)}return s.object=o,s;function h(d){let u=[];for(let p in d){let m=d[p];delete m.metadata,u.push(m)}return u}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let s=0;s<t.children.length;s++){let o=t.children[s];this.add(o.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};ie.DEFAULT_UP=new E(0,1,0);ie.DEFAULT_MATRIX_AUTO_UPDATE=!0;ie.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var wr={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Qt={h:0,s:0,l:0},An={h:0,s:0,l:0};function Ii(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var ot=class{constructor(t,e,s){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,s)}set(t,e,s){if(e===void 0&&s===void 0){let o=t;o&&o.isColor?this.copy(o):typeof o=="number"?this.setHex(o):typeof o=="string"&&this.setStyle(o)}else this.setRGB(t,e,s);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Pt){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Ct.colorSpaceToWorking(this,e),this}setRGB(t,e,s,o=Ct.workingColorSpace){return this.r=t,this.g=e,this.b=s,Ct.colorSpaceToWorking(this,o),this}setHSL(t,e,s,o=Ct.workingColorSpace){if(t=ba(t,1),e=K(e,0,1),s=K(s,0,1),e===0)this.r=this.g=this.b=s;else{let l=s<=.5?s*(1+e):s+e-s*e,h=2*s-l;this.r=Ii(h,l,t+1/3),this.g=Ii(h,l,t),this.b=Ii(h,l,t-1/3)}return Ct.colorSpaceToWorking(this,o),this}setStyle(t,e=Pt){function s(l){l!==void 0&&parseFloat(l)<1&&at("Color: Alpha component of "+t+" will be ignored.")}let o;if(o=/^(\w+)\(([^\)]*)\)/.exec(t)){let l,h=o[1],d=o[2];switch(h){case"rgb":case"rgba":if(l=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setRGB(Math.min(255,parseInt(l[1],10))/255,Math.min(255,parseInt(l[2],10))/255,Math.min(255,parseInt(l[3],10))/255,e);if(l=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setRGB(Math.min(100,parseInt(l[1],10))/100,Math.min(100,parseInt(l[2],10))/100,Math.min(100,parseInt(l[3],10))/100,e);break;case"hsl":case"hsla":if(l=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(l[4]),this.setHSL(parseFloat(l[1])/360,parseFloat(l[2])/100,parseFloat(l[3])/100,e);break;default:at("Color: Unknown color model "+t)}}else if(o=/^\#([A-Fa-f\d]+)$/.exec(t)){let l=o[1],h=l.length;if(h===3)return this.setRGB(parseInt(l.charAt(0),16)/15,parseInt(l.charAt(1),16)/15,parseInt(l.charAt(2),16)/15,e);if(h===6)return this.setHex(parseInt(l,16),e);at("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Pt){let s=wr[t.toLowerCase()];return s!==void 0?this.setHex(s,e):at("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Yt(t.r),this.g=Yt(t.g),this.b=Yt(t.b),this}copyLinearToSRGB(t){return this.r=Fe(t.r),this.g=Fe(t.g),this.b=Fe(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Pt){return Ct.workingToColorSpace(pt.copy(this),t),Math.round(K(pt.r*255,0,255))*65536+Math.round(K(pt.g*255,0,255))*256+Math.round(K(pt.b*255,0,255))}getHexString(t=Pt){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Ct.workingColorSpace){Ct.workingToColorSpace(pt.copy(this),e);let s=pt.r,o=pt.g,l=pt.b,h=Math.max(s,o,l),d=Math.min(s,o,l),u,p,m=(d+h)/2;if(d===h)u=0,p=0;else{let _=h-d;switch(p=m<=.5?_/(h+d):_/(2-h-d),h){case s:u=(o-l)/_+(o<l?6:0);break;case o:u=(l-s)/_+2;break;case l:u=(s-o)/_+4;break}u/=6}return t.h=u,t.s=p,t.l=m,t}getRGB(t,e=Ct.workingColorSpace){return Ct.workingToColorSpace(pt.copy(this),e),t.r=pt.r,t.g=pt.g,t.b=pt.b,t}getStyle(t=Pt){Ct.workingToColorSpace(pt.copy(this),t);let e=pt.r,s=pt.g,o=pt.b;return t!==Pt?`color(${t} ${e.toFixed(3)} ${s.toFixed(3)} ${o.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(s*255)},${Math.round(o*255)})`}offsetHSL(t,e,s){return this.getHSL(Qt),this.setHSL(Qt.h+t,Qt.s+e,Qt.l+s)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,s){return this.r=t.r+(e.r-t.r)*s,this.g=t.g+(e.g-t.g)*s,this.b=t.b+(e.b-t.b)*s,this}lerpHSL(t,e){this.getHSL(Qt),t.getHSL(An);let s=Ti(Qt.h,An.h,e),o=Ti(Qt.s,An.s,e),l=Ti(Qt.l,An.l,e);return this.setHSL(s,o,l),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,s=this.g,o=this.b,l=t.elements;return this.r=l[0]*e+l[3]*s+l[6]*o,this.g=l[1]*e+l[4]*s+l[7]*o,this.b=l[2]*e+l[5]*s+l[8]*o,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},pt=new ot;ot.NAMES=wr;var Nt=new E,Ht=new E,Ri=new E,Gt=new E,Ce=new E,Pe=new E,Js=new E,Li=new E,Ni=new E,Di=new E,Oi=new Be,Fi=new Be,Ui=new Be,ee=class i{constructor(t=new E,e=new E,s=new E){this.a=t,this.b=e,this.c=s}static getNormal(t,e,s,o){o.subVectors(s,e),Nt.subVectors(t,e),o.cross(Nt);let l=o.lengthSq();return l>0?o.multiplyScalar(1/Math.sqrt(l)):o.set(0,0,0)}static getBarycoord(t,e,s,o,l){Nt.subVectors(o,e),Ht.subVectors(s,e),Ri.subVectors(t,e);let h=Nt.dot(Nt),d=Nt.dot(Ht),u=Nt.dot(Ri),p=Ht.dot(Ht),m=Ht.dot(Ri),_=h*p-d*d;if(_===0)return l.set(0,0,0),null;let y=1/_,v=(p*u-d*m)*y,S=(h*m-d*u)*y;return l.set(1-v-S,S,v)}static containsPoint(t,e,s,o){return this.getBarycoord(t,e,s,o,Gt)===null?!1:Gt.x>=0&&Gt.y>=0&&Gt.x+Gt.y<=1}static getInterpolation(t,e,s,o,l,h,d,u){return this.getBarycoord(t,e,s,o,Gt)===null?(u.x=0,u.y=0,"z"in u&&(u.z=0),"w"in u&&(u.w=0),null):(u.setScalar(0),u.addScaledVector(l,Gt.x),u.addScaledVector(h,Gt.y),u.addScaledVector(d,Gt.z),u)}static getInterpolatedAttribute(t,e,s,o,l,h){return Oi.setScalar(0),Fi.setScalar(0),Ui.setScalar(0),Oi.fromBufferAttribute(t,e),Fi.fromBufferAttribute(t,s),Ui.fromBufferAttribute(t,o),h.setScalar(0),h.addScaledVector(Oi,l.x),h.addScaledVector(Fi,l.y),h.addScaledVector(Ui,l.z),h}static isFrontFacing(t,e,s,o){return Nt.subVectors(s,e),Ht.subVectors(t,e),Nt.cross(Ht).dot(o)<0}set(t,e,s){return this.a.copy(t),this.b.copy(e),this.c.copy(s),this}setFromPointsAndIndices(t,e,s,o){return this.a.copy(t[e]),this.b.copy(t[s]),this.c.copy(t[o]),this}setFromAttributeAndIndices(t,e,s,o){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,s),this.c.fromBufferAttribute(t,o),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Nt.subVectors(this.c,this.b),Ht.subVectors(this.a,this.b),Nt.cross(Ht).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,s,o,l){return i.getInterpolation(t,this.a,this.b,this.c,e,s,o,l)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let s=this.a,o=this.b,l=this.c,h,d;Ce.subVectors(o,s),Pe.subVectors(l,s),Li.subVectors(t,s);let u=Ce.dot(Li),p=Pe.dot(Li);if(u<=0&&p<=0)return e.copy(s);Ni.subVectors(t,o);let m=Ce.dot(Ni),_=Pe.dot(Ni);if(m>=0&&_<=m)return e.copy(o);let y=u*_-m*p;if(y<=0&&u>=0&&m<=0)return h=u/(u-m),e.copy(s).addScaledVector(Ce,h);Di.subVectors(t,l);let v=Ce.dot(Di),S=Pe.dot(Di);if(S>=0&&v<=S)return e.copy(l);let T=v*p-u*S;if(T<=0&&p>=0&&S<=0)return d=p/(p-S),e.copy(s).addScaledVector(Pe,d);let A=m*S-v*_;if(A<=0&&_-m>=0&&v-S>=0)return Js.subVectors(l,o),d=(_-m)/(_-m+(v-S)),e.copy(o).addScaledVector(Js,d);let P=1/(A+T+y);return h=T*P,d=y*P,e.copy(s).addScaledVector(Ce,h).addScaledVector(Pe,d)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},Zt=class{constructor(t=new E(1/0,1/0,1/0),e=new E(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,s=t.length;e<s;e+=3)this.expandByPoint(Dt.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,s=t.count;e<s;e++)this.expandByPoint(Dt.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,s=t.length;e<s;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let s=Dt.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(s),this.max.copy(t).add(s),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let s=t.geometry;if(s!==void 0){let l=s.getAttribute("position");if(e===!0&&l!==void 0&&t.isInstancedMesh!==!0)for(let h=0,d=l.count;h<d;h++)t.isMesh===!0?t.getVertexPosition(h,Dt):Dt.fromBufferAttribute(l,h),Dt.applyMatrix4(t.matrixWorld),this.expandByPoint(Dt);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),wn.copy(t.boundingBox)):(s.boundingBox===null&&s.computeBoundingBox(),wn.copy(s.boundingBox)),wn.applyMatrix4(t.matrixWorld),this.union(wn)}let o=t.children;for(let l=0,h=o.length;l<h;l++)this.expandByObject(o[l],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Dt),Dt.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,s;return t.normal.x>0?(e=t.normal.x*this.min.x,s=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,s=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,s+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,s+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,s+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,s+=t.normal.z*this.min.z),e<=-t.constant&&s>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ke),Cn.subVectors(this.max,Ke),Ie.subVectors(t.a,Ke),Re.subVectors(t.b,Ke),Le.subVectors(t.c,Ke),jt.subVectors(Re,Ie),te.subVectors(Le,Re),ue.subVectors(Ie,Le);let e=[0,-jt.z,jt.y,0,-te.z,te.y,0,-ue.z,ue.y,jt.z,0,-jt.x,te.z,0,-te.x,ue.z,0,-ue.x,-jt.y,jt.x,0,-te.y,te.x,0,-ue.y,ue.x,0];return!Bi(e,Ie,Re,Le,Cn)||(e=[1,0,0,0,1,0,0,0,1],!Bi(e,Ie,Re,Le,Cn))?!1:(Pn.crossVectors(jt,te),e=[Pn.x,Pn.y,Pn.z],Bi(e,Ie,Re,Le,Cn))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Dt).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Dt).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Xt[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Xt[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Xt[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Xt[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Xt[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Xt[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Xt[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Xt[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Xt),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Xt=[new E,new E,new E,new E,new E,new E,new E,new E],Dt=new E,wn=new Zt,Ie=new E,Re=new E,Le=new E,jt=new E,te=new E,ue=new E,Ke=new E,Cn=new E,Pn=new E,fe=new E;function Bi(i,t,e,s,o){for(let l=0,h=i.length-3;l<=h;l+=3){fe.fromArray(i,l);let d=o.x*Math.abs(fe.x)+o.y*Math.abs(fe.y)+o.z*Math.abs(fe.z),u=t.dot(fe),p=e.dot(fe),m=s.dot(fe);if(Math.max(-Math.max(u,p,m),Math.min(u,p,m))>d)return!1}return!0}var lt=new E,In=new k,Na=0,Et=class extends ne{constructor(t,e,s=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Na++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=s,this.usage=Er,this.updateRanges=[],this.gpuType=Mr,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,s){t*=this.itemSize,s*=e.itemSize;for(let o=0,l=this.itemSize;o<l;o++)this.array[t+o]=e.array[s+o];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,s=this.count;e<s;e++)In.fromBufferAttribute(this,e),In.applyMatrix3(t),this.setXY(e,In.x,In.y);else if(this.itemSize===3)for(let e=0,s=this.count;e<s;e++)lt.fromBufferAttribute(this,e),lt.applyMatrix3(t),this.setXYZ(e,lt.x,lt.y,lt.z);return this}applyMatrix4(t){for(let e=0,s=this.count;e<s;e++)lt.fromBufferAttribute(this,e),lt.applyMatrix4(t),this.setXYZ(e,lt.x,lt.y,lt.z);return this}applyNormalMatrix(t){for(let e=0,s=this.count;e<s;e++)lt.fromBufferAttribute(this,e),lt.applyNormalMatrix(t),this.setXYZ(e,lt.x,lt.y,lt.z);return this}transformDirection(t){for(let e=0,s=this.count;e<s;e++)lt.fromBufferAttribute(this,e),lt.transformDirection(t),this.setXYZ(e,lt.x,lt.y,lt.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let s=this.array[t*this.itemSize+e];return this.normalized&&(s=Je(s,this.array)),s}setComponent(t,e,s){return this.normalized&&(s=yt(s,this.array)),this.array[t*this.itemSize+e]=s,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Je(e,this.array)),e}setX(t,e){return this.normalized&&(e=yt(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Je(e,this.array)),e}setY(t,e){return this.normalized&&(e=yt(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Je(e,this.array)),e}setZ(t,e){return this.normalized&&(e=yt(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Je(e,this.array)),e}setW(t,e){return this.normalized&&(e=yt(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,s){return t*=this.itemSize,this.normalized&&(e=yt(e,this.array),s=yt(s,this.array)),this.array[t+0]=e,this.array[t+1]=s,this}setXYZ(t,e,s,o){return t*=this.itemSize,this.normalized&&(e=yt(e,this.array),s=yt(s,this.array),o=yt(o,this.array)),this.array[t+0]=e,this.array[t+1]=s,this.array[t+2]=o,this}setXYZW(t,e,s,o,l){return t*=this.itemSize,this.normalized&&(e=yt(e,this.array),s=yt(s,this.array),o=yt(o,this.array),l=yt(l,this.array)),this.array[t+0]=e,this.array[t+1]=s,this.array[t+2]=o,this.array[t+3]=l,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var Kn=class extends Et{constructor(t,e,s){super(new Uint16Array(t),e,s)}};var Qn=class extends Et{constructor(t,e,s){super(new Uint32Array(t),e,s)}};var zt=class extends Et{constructor(t,e,s){super(new Float32Array(t),e,s)}},Da=new Zt,Qe=new E,zi=new E,an=class{constructor(t=new E,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let s=this.center;e!==void 0?s.copy(e):Da.setFromPoints(t).getCenter(s);let o=0;for(let l=0,h=t.length;l<h;l++)o=Math.max(o,s.distanceToSquared(t[l]));return this.radius=Math.sqrt(o),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let s=this.center.distanceToSquared(t);return e.copy(t),s>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Qe.subVectors(t,this.center);let e=Qe.lengthSq();if(e>this.radius*this.radius){let s=Math.sqrt(e),o=(s-this.radius)*.5;this.center.addScaledVector(Qe,o/s),this.radius+=o}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(zi.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Qe.copy(t.center).add(zi)),this.expandByPoint(Qe.copy(t.center).sub(zi))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Oa=0,wt=new vt,Vi=new ie,Ne=new E,Tt=new Zt,je=new Zt,ht=new E,Vt=class i extends ne{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Oa++}),this.uuid=We(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(ya(t)?Qn:Kn)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,s=0){this.groups.push({start:t,count:e,materialIndex:s})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let s=this.attributes.normal;if(s!==void 0){let l=new q().getNormalMatrix(t);s.applyNormalMatrix(l),s.needsUpdate=!0}let o=this.attributes.tangent;return o!==void 0&&(o.transformDirection(t),o.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return wt.makeRotationFromQuaternion(t),this.applyMatrix4(wt),this}rotateX(t){return wt.makeRotationX(t),this.applyMatrix4(wt),this}rotateY(t){return wt.makeRotationY(t),this.applyMatrix4(wt),this}rotateZ(t){return wt.makeRotationZ(t),this.applyMatrix4(wt),this}translate(t,e,s){return wt.makeTranslation(t,e,s),this.applyMatrix4(wt),this}scale(t,e,s){return wt.makeScale(t,e,s),this.applyMatrix4(wt),this}lookAt(t){return Vi.lookAt(t),Vi.updateMatrix(),this.applyMatrix4(Vi.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ne).negate(),this.translate(Ne.x,Ne.y,Ne.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let s=[];for(let o=0,l=t.length;o<l;o++){let h=t[o];s.push(h.x,h.y,h.z||0)}this.setAttribute("position",new zt(s,3))}else{let s=Math.min(t.length,e.count);for(let o=0;o<s;o++){let l=t[o];e.setXYZ(o,l.x,l.y,l.z||0)}t.length>e.count&&at("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Zt);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){it("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new E(-1/0,-1/0,-1/0),new E(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let s=0,o=e.length;s<o;s++){let l=e[s];Tt.setFromBufferAttribute(l),this.morphTargetsRelative?(ht.addVectors(this.boundingBox.min,Tt.min),this.boundingBox.expandByPoint(ht),ht.addVectors(this.boundingBox.max,Tt.max),this.boundingBox.expandByPoint(ht)):(this.boundingBox.expandByPoint(Tt.min),this.boundingBox.expandByPoint(Tt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&it('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new an);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){it("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new E,1/0);return}if(t){let s=this.boundingSphere.center;if(Tt.setFromBufferAttribute(t),e)for(let l=0,h=e.length;l<h;l++){let d=e[l];je.setFromBufferAttribute(d),this.morphTargetsRelative?(ht.addVectors(Tt.min,je.min),Tt.expandByPoint(ht),ht.addVectors(Tt.max,je.max),Tt.expandByPoint(ht)):(Tt.expandByPoint(je.min),Tt.expandByPoint(je.max))}Tt.getCenter(s);let o=0;for(let l=0,h=t.count;l<h;l++)ht.fromBufferAttribute(t,l),o=Math.max(o,s.distanceToSquared(ht));if(e)for(let l=0,h=e.length;l<h;l++){let d=e[l],u=this.morphTargetsRelative;for(let p=0,m=d.count;p<m;p++)ht.fromBufferAttribute(d,p),u&&(Ne.fromBufferAttribute(t,p),ht.add(Ne)),o=Math.max(o,s.distanceToSquared(ht))}this.boundingSphere.radius=Math.sqrt(o),isNaN(this.boundingSphere.radius)&&it('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){it("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let s=e.position,o=e.normal,l=e.uv,h=this.getAttribute("tangent");(h===void 0||h.count!==s.count)&&(h=new Et(new Float32Array(4*s.count),4),this.setAttribute("tangent",h));let d=[],u=[];for(let O=0;O<s.count;O++)d[O]=new E,u[O]=new E;let p=new E,m=new E,_=new E,y=new k,v=new k,S=new k,T=new E,A=new E;function P(O,X,V){p.fromBufferAttribute(s,O),m.fromBufferAttribute(s,X),_.fromBufferAttribute(s,V),y.fromBufferAttribute(l,O),v.fromBufferAttribute(l,X),S.fromBufferAttribute(l,V),m.sub(p),_.sub(p),v.sub(y),S.sub(y);let H=1/(v.x*S.y-S.x*v.y);isFinite(H)&&(T.copy(m).multiplyScalar(S.y).addScaledVector(_,-v.y).multiplyScalar(H),A.copy(_).multiplyScalar(v.x).addScaledVector(m,-S.x).multiplyScalar(H),d[O].add(T),d[X].add(T),d[V].add(T),u[O].add(A),u[X].add(A),u[V].add(A))}let N=this.groups;N.length===0&&(N=[{start:0,count:t.count}]);for(let O=0,X=N.length;O<X;++O){let V=N[O],H=V.start,j=V.count;for(let W=H,tt=H+j;W<tt;W+=3)P(t.getX(W+0),t.getX(W+1),t.getX(W+2))}let C=new E,I=new E,D=new E,B=new E;function z(O){D.fromBufferAttribute(o,O),B.copy(D);let X=d[O];C.copy(X),C.sub(D.multiplyScalar(D.dot(X))).normalize(),I.crossVectors(B,X);let H=I.dot(u[O])<0?-1:1;h.setXYZW(O,C.x,C.y,C.z,H)}for(let O=0,X=N.length;O<X;++O){let V=N[O],H=V.start,j=V.count;for(let W=H,tt=H+j;W<tt;W+=3)z(t.getX(W+0)),z(t.getX(W+1)),z(t.getX(W+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let s=this.getAttribute("normal");if(s===void 0||s.count!==e.count)s=new Et(new Float32Array(e.count*3),3),this.setAttribute("normal",s);else for(let y=0,v=s.count;y<v;y++)s.setXYZ(y,0,0,0);let o=new E,l=new E,h=new E,d=new E,u=new E,p=new E,m=new E,_=new E;if(t)for(let y=0,v=t.count;y<v;y+=3){let S=t.getX(y+0),T=t.getX(y+1),A=t.getX(y+2);o.fromBufferAttribute(e,S),l.fromBufferAttribute(e,T),h.fromBufferAttribute(e,A),m.subVectors(h,l),_.subVectors(o,l),m.cross(_),d.fromBufferAttribute(s,S),u.fromBufferAttribute(s,T),p.fromBufferAttribute(s,A),d.add(m),u.add(m),p.add(m),s.setXYZ(S,d.x,d.y,d.z),s.setXYZ(T,u.x,u.y,u.z),s.setXYZ(A,p.x,p.y,p.z)}else for(let y=0,v=e.count;y<v;y+=3)o.fromBufferAttribute(e,y+0),l.fromBufferAttribute(e,y+1),h.fromBufferAttribute(e,y+2),m.subVectors(h,l),_.subVectors(o,l),m.cross(_),s.setXYZ(y+0,m.x,m.y,m.z),s.setXYZ(y+1,m.x,m.y,m.z),s.setXYZ(y+2,m.x,m.y,m.z);this.normalizeNormals(),s.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,s=t.count;e<s;e++)ht.fromBufferAttribute(t,e),ht.normalize(),t.setXYZ(e,ht.x,ht.y,ht.z)}toNonIndexed(){function t(d,u){let p=d.array,m=d.itemSize,_=d.normalized,y=new p.constructor(u.length*m),v=0,S=0;for(let T=0,A=u.length;T<A;T++){d.isInterleavedBufferAttribute?v=u[T]*d.data.stride+d.offset:v=u[T]*m;for(let P=0;P<m;P++)y[S++]=p[v++]}return new Et(y,m,_)}if(this.index===null)return at("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,s=this.index.array,o=this.attributes;for(let d in o){let u=o[d],p=t(u,s);e.setAttribute(d,p)}let l=this.morphAttributes;for(let d in l){let u=[],p=l[d];for(let m=0,_=p.length;m<_;m++){let y=p[m],v=t(y,s);u.push(v)}e.morphAttributes[d]=u}e.morphTargetsRelative=this.morphTargetsRelative;let h=this.groups;for(let d=0,u=h.length;d<u;d++){let p=h[d];e.addGroup(p.start,p.count,p.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let u=this.parameters;for(let p in u)u[p]!==void 0&&(t[p]=u[p]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let s=this.attributes;for(let u in s){let p=s[u];t.data.attributes[u]=p.toJSON(t.data)}let o={},l=!1;for(let u in this.morphAttributes){let p=this.morphAttributes[u],m=[];for(let _=0,y=p.length;_<y;_++){let v=p[_];m.push(v.toJSON(t.data))}m.length>0&&(o[u]=m,l=!0)}l&&(t.data.morphAttributes=o,t.data.morphTargetsRelative=this.morphTargetsRelative);let h=this.groups;h.length>0&&(t.data.groups=JSON.parse(JSON.stringify(h)));let d=this.boundingSphere;return d!==null&&(t.data.boundingSphere=d.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let s=t.index;s!==null&&this.setIndex(s.clone());let o=t.attributes;for(let p in o){let m=o[p];this.setAttribute(p,m.clone(e))}let l=t.morphAttributes;for(let p in l){let m=[],_=l[p];for(let y=0,v=_.length;y<v;y++)m.push(_[y].clone(e));this.morphAttributes[p]=m}this.morphTargetsRelative=t.morphTargetsRelative;let h=t.groups;for(let p=0,m=h.length;p<m;p++){let _=h[p];this.addGroup(_.start,_.count,_.materialIndex)}let d=t.boundingBox;d!==null&&(this.boundingBox=d.clone());let u=t.boundingSphere;return u!==null&&(this.boundingSphere=u.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var ki=new E,Fa=new E,Ua=new q,pe=class{constructor(t=new E(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,s,o){return this.normal.set(t,e,s),this.constant=o,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,s){let o=ki.subVectors(s,e).cross(Fa.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(o,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,s=!0){let o=t.delta(ki),l=this.normal.dot(o);if(l===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let h=-(t.start.dot(this.normal)+this.constant)/l;return s===!0&&(h<0||h>1)?null:e.copy(t.start).addScaledVector(o,h)}intersectsLine(t){let e=this.distanceToPoint(t.start),s=this.distanceToPoint(t.end);return e<0&&s>0||s<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let s=e||Ua.getNormalMatrix(t),o=this.coplanarPoint(ki).applyMatrix4(t),l=this.normal.applyMatrix3(s).normalize();return this.constant=-o.dot(l),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},Ba=0,jn=class extends ne{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ba++}),this.uuid=We(),this.name="",this.type="Material",this.blending=ur,this.side=gi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=dr,this.blendDst=pr,this.blendEquation=fr,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ot(0,0,0),this.blendAlpha=0,this.depthFunc=Wn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Tr,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Xn,this.stencilZFail=Xn,this.stencilZPass=Xn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let s=t[e];if(s===void 0){at(`Material: parameter '${e}' has value of undefined.`);continue}let o=this[e];if(o===void 0){at(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}o&&o.isColor?o.set(s):o&&o.isVector2&&s&&s.isVector2||o&&o.isEuler&&s&&s.isEuler||o&&o.isVector3&&s&&s.isVector3?o.copy(s):this[e]=s}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let s={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};s.uuid=this.uuid,s.type=this.type,s.blending=this.blending,s.side=this.side,s.shadowSide=this.shadowSide,s.vertexColors=this.vertexColors,s.opacity=this.opacity,s.transparent=this.transparent,s.blendSrc=this.blendSrc,s.blendDst=this.blendDst,s.blendEquation=this.blendEquation,s.blendSrcAlpha=this.blendSrcAlpha,s.blendDstAlpha=this.blendDstAlpha,s.blendEquationAlpha=this.blendEquationAlpha,s.blendColor=this.blendColor.getHex(),s.blendAlpha=this.blendAlpha,s.depthFunc=this.depthFunc,s.depthTest=this.depthTest,s.depthWrite=this.depthWrite,s.colorWrite=this.colorWrite,s.clipIntersection=this.clipIntersection,s.clipShadows=this.clipShadows,s.stencilWriteMask=this.stencilWriteMask,s.stencilFunc=this.stencilFunc,s.stencilRef=this.stencilRef,s.stencilFuncMask=this.stencilFuncMask,s.stencilFail=this.stencilFail,s.stencilZFail=this.stencilZFail,s.stencilZPass=this.stencilZPass,s.stencilWrite=this.stencilWrite,s.polygonOffset=this.polygonOffset,s.polygonOffsetFactor=this.polygonOffsetFactor,s.polygonOffsetUnits=this.polygonOffsetUnits,s.dithering=this.dithering,s.alphaTest=this.alphaTest,s.alphaHash=this.alphaHash,s.alphaToCoverage=this.alphaToCoverage,s.premultipliedAlpha=this.premultipliedAlpha,s.forceSinglePass=this.forceSinglePass,s.allowOverride=this.allowOverride,s.visible=this.visible,s.toneMapped=this.toneMapped,s.name=this.name,this.color&&this.color.isColor&&(s.color=this.color.getHex()),this.roughness!==void 0&&(s.roughness=this.roughness),this.metalness!==void 0&&(s.metalness=this.metalness),this.sheen!==void 0&&(s.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(s.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(s.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(s.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(s.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(s.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(s.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(s.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(s.shininess=this.shininess),this.clearcoat!==void 0&&(s.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(s.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(s.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(s.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(s.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,s.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(s.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(s.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(s.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(s.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(s.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(s.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(s.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(s.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(s.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(s.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(s.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(s.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(s.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(s.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(s.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(s.lightMap=this.lightMap.toJSON(t).uuid,s.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(s.aoMap=this.aoMap.toJSON(t).uuid,s.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(s.bumpMap=this.bumpMap.toJSON(t).uuid,s.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(s.normalMap=this.normalMap.toJSON(t).uuid,s.normalMapType=this.normalMapType,s.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(s.displacementMap=this.displacementMap.toJSON(t).uuid,s.displacementScale=this.displacementScale,s.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(s.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(s.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(s.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(s.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(s.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(s.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(s.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(s.combine=this.combine)),this.envMapRotation!==void 0&&(s.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(s.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(s.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(s.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(s.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(s.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(s.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(s.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(s.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(s.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(s.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(s.size=this.size),this.sizeAttenuation!==void 0&&(s.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(s.clippingPlanes=this.clippingPlanes.map(l=>l.toJSON())),this.rotation!==void 0&&(s.rotation=this.rotation),this.depthPacking!==void 0&&(s.depthPacking=this.depthPacking),this.linewidth!==void 0&&(s.linewidth=this.linewidth),this.linecap!==void 0&&(s.linecap=this.linecap),this.linejoin!==void 0&&(s.linejoin=this.linejoin),this.dashSize!==void 0&&(s.dashSize=this.dashSize),this.gapSize!==void 0&&(s.gapSize=this.gapSize),this.scale!==void 0&&(s.scale=this.scale),this.wireframe!==void 0&&(s.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(s.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(s.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(s.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(s.flatShading=this.flatShading),this.fog!==void 0&&(s.fog=this.fog),Object.keys(this.userData).length>0&&(s.userData=this.userData);function o(l){let h=[];for(let d in l){let u=l[d];delete u.metadata,h.push(u)}return h}if(e){let l=o(t.textures),h=o(t.images);l.length>0&&(s.textures=l),h.length>0&&(s.images=h)}return s}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new ot().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(s=>new pe().fromJSON(s))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let s=t.normalScale;Array.isArray(s)===!1&&(s=[s,s]),this.normalScale=new k().fromArray(s)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new k().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,s=null;if(e!==null){let o=e.length;s=new Array(o);for(let l=0;l!==o;++l)s[l]=e[l].clone()}return this.clippingPlanes=s,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Wt=new E,Hi=new E,Rn=new E,Ln=new E,ti=class{constructor(t=new E,e=new E(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Wt)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let s=e.dot(this.direction);return s<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,s)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Wt.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Wt.copy(this.origin).addScaledVector(this.direction,e),Wt.distanceToSquared(t))}distanceSqToSegment(t,e,s,o){Hi.copy(t).add(e).multiplyScalar(.5),Rn.copy(e).sub(t).normalize(),Ln.copy(this.origin).sub(Hi);let l=t.distanceTo(e)*.5,h=-this.direction.dot(Rn),d=Ln.dot(this.direction),u=-Ln.dot(Rn),p=Ln.lengthSq(),m=Math.abs(1-h*h),_,y,v,S;if(m>0)if(_=h*u-d,y=h*d-u,S=l*m,_>=0)if(y>=-S)if(y<=S){let T=1/m;_*=T,y*=T,v=_*(_+h*y+2*d)+y*(h*_+y+2*u)+p}else y=l,_=Math.max(0,-(h*y+d)),v=-_*_+y*(y+2*u)+p;else y=-l,_=Math.max(0,-(h*y+d)),v=-_*_+y*(y+2*u)+p;else y<=-S?(_=Math.max(0,-(-h*l+d)),y=_>0?-l:Math.min(Math.max(-l,-u),l),v=-_*_+y*(y+2*u)+p):y<=S?(_=0,y=Math.min(Math.max(-l,-u),l),v=y*(y+2*u)+p):(_=Math.max(0,-(h*l+d)),y=_>0?l:Math.min(Math.max(-l,-u),l),v=-_*_+y*(y+2*u)+p);else y=h>0?-l:l,_=Math.max(0,-(h*y+d)),v=-_*_+y*(y+2*u)+p;return s&&s.copy(this.origin).addScaledVector(this.direction,_),o&&o.copy(Hi).addScaledVector(Rn,y),v}intersectSphere(t,e){if(t.radius<0)return null;Wt.subVectors(t.center,this.origin);let s=Wt.dot(this.direction),o=Wt.dot(Wt)-s*s,l=t.radius*t.radius;if(o>l)return null;let h=Math.sqrt(l-o),d=s-h,u=s+h;return u<0?null:d<0?this.at(u,e):this.at(d,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let s=-(this.origin.dot(t.normal)+t.constant)/e;return s>=0?s:null}intersectPlane(t,e){let s=this.distanceToPlane(t);return s===null?null:this.at(s,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let s,o,l,h,d,u,p=1/this.direction.x,m=1/this.direction.y,_=1/this.direction.z,y=this.origin;return p>=0?(s=(t.min.x-y.x)*p,o=(t.max.x-y.x)*p):(s=(t.max.x-y.x)*p,o=(t.min.x-y.x)*p),m>=0?(l=(t.min.y-y.y)*m,h=(t.max.y-y.y)*m):(l=(t.max.y-y.y)*m,h=(t.min.y-y.y)*m),s>h||l>o||((l>s||isNaN(s))&&(s=l),(h<o||isNaN(o))&&(o=h),_>=0?(d=(t.min.z-y.z)*_,u=(t.max.z-y.z)*_):(d=(t.max.z-y.z)*_,u=(t.min.z-y.z)*_),s>u||d>o)||((d>s||s!==s)&&(s=d),(u<o||o!==o)&&(o=u),o<0)?null:this.at(s>=0?s:o,e)}intersectsBox(t){return this.intersectBox(t,Wt)!==null}intersectTriangle(t,e,s,o,l){let h=this.origin,d=this.direction,u=d.x,p=d.y,m=d.z,_=t.x-h.x,y=t.y-h.y,v=t.z-h.z,S=e.x-h.x,T=e.y-h.y,A=e.z-h.z,P=s.x-h.x,N=s.y-h.y,C=s.z-h.z,I=Math.abs(u),D=Math.abs(p),B=Math.abs(m),z,O,X,V,H,j,W,tt,Y,ct,ft,Mt;if(I>=D&&I>=B?(X=u,j=_,Y=S,Mt=P,u>=0?(z=p,O=m,V=y,H=v,W=T,tt=A,ct=N,ft=C):(z=m,O=p,V=v,H=y,W=A,tt=T,ct=C,ft=N)):D>=B?(X=p,j=y,Y=T,Mt=N,p>=0?(z=m,O=u,V=v,H=_,W=A,tt=S,ct=C,ft=P):(z=u,O=m,V=_,H=v,W=S,tt=A,ct=P,ft=C)):(X=m,j=v,Y=A,Mt=C,m>=0?(z=u,O=p,V=_,H=y,W=S,tt=T,ct=P,ft=N):(z=p,O=u,V=y,H=_,W=T,tt=S,ct=N,ft=P)),X===0)return null;let Ot=z/X,Ft=O/X,$t=1/X,yn=V-Ot*j,vn=H-Ft*j,Ut=W-Ot*Y,Sn=tt-Ft*Y,Mn=ct-Ot*Mt,bn=ft-Ft*Mt,le=Mn*Sn-bn*Ut,ce=yn*bn-vn*Mn,he=Ut*vn-Sn*yn;if(o){if(le<0||ce<0||he<0)return null}else if((le<0||ce<0||he<0)&&(le>0||ce>0||he>0))return null;let Rt=le+ce+he;if(Rt===0)return null;let qe=$t*(le*j+ce*Y+he*Mt);return(Rt>0?qe<0:qe>0)?null:this.at(qe/Rt,l)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},ln=class extends jn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ot(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ze,this.combine=gs,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},$s=new vt,de=new ti,Nn=new an,Ks=new E,Dn=new E,On=new E,Fn=new E,Gi=new E,Un=new E,Qs=new E,Bn=new E,Ve=class extends ie{constructor(t=new Vt,e=new ln){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,s=Object.keys(e);if(s.length>0){let o=e[s[0]];if(o!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let l=0,h=o.length;l<h;l++){let d=o[l].name||String(l);this.morphTargetInfluences.push(0),this.morphTargetDictionary[d]=l}}}}getVertexPosition(t,e){let s=this.geometry,o=s.attributes.position,l=s.morphAttributes.position,h=s.morphTargetsRelative;e.fromBufferAttribute(o,t);let d=this.morphTargetInfluences;if(l&&d){Un.set(0,0,0);for(let u=0,p=l.length;u<p;u++){let m=d[u],_=l[u];m!==0&&(Gi.fromBufferAttribute(_,t),h?Un.addScaledVector(Gi,m):Un.addScaledVector(Gi.sub(e),m))}e.add(Un)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let s=this.geometry,o=this.material,l=this.matrixWorld;o!==void 0&&(s.boundingSphere===null&&s.computeBoundingSphere(),Nn.copy(s.boundingSphere),Nn.applyMatrix4(l),de.copy(t.ray).recast(t.near),!(Nn.containsPoint(de.origin)===!1&&(de.intersectSphere(Nn,Ks)===null||de.origin.distanceToSquared(Ks)>(t.far-t.near)**2))&&($s.copy(l).invert(),de.copy(t.ray).applyMatrix4($s),!(s.boundingBox!==null&&de.intersectsBox(s.boundingBox)===!1)&&this._computeIntersections(t,e,de)))}_computeIntersections(t,e,s){let o,l=this.geometry,h=this.material,d=l.index,u=l.attributes.position,p=l.attributes.uv,m=l.attributes.uv1,_=l.attributes.normal,y=l.groups,v=l.drawRange;if(d!==null)if(Array.isArray(h))for(let S=0,T=y.length;S<T;S++){let A=y[S],P=h[A.materialIndex],N=Math.max(A.start,v.start),C=Math.min(d.count,Math.min(A.start+A.count,v.start+v.count));for(let I=N,D=C;I<D;I+=3){let B=d.getX(I),z=d.getX(I+1),O=d.getX(I+2);o=zn(this,P,t,s,p,m,_,B,z,O),o&&(o.faceIndex=Math.floor(I/3),o.face.materialIndex=A.materialIndex,e.push(o))}}else{let S=Math.max(0,v.start),T=Math.min(d.count,v.start+v.count);for(let A=S,P=T;A<P;A+=3){let N=d.getX(A),C=d.getX(A+1),I=d.getX(A+2);o=zn(this,h,t,s,p,m,_,N,C,I),o&&(o.faceIndex=Math.floor(A/3),e.push(o))}}else if(u!==void 0)if(Array.isArray(h))for(let S=0,T=y.length;S<T;S++){let A=y[S],P=h[A.materialIndex],N=Math.max(A.start,v.start),C=Math.min(u.count,Math.min(A.start+A.count,v.start+v.count));for(let I=N,D=C;I<D;I+=3){let B=I,z=I+1,O=I+2;o=zn(this,P,t,s,p,m,_,B,z,O),o&&(o.faceIndex=Math.floor(I/3),o.face.materialIndex=A.materialIndex,e.push(o))}}else{let S=Math.max(0,v.start),T=Math.min(u.count,v.start+v.count);for(let A=S,P=T;A<P;A+=3){let N=A,C=A+1,I=A+2;o=zn(this,h,t,s,p,m,_,N,C,I),o&&(o.faceIndex=Math.floor(A/3),e.push(o))}}}};function za(i,t,e,s,o,l,h,d){let u;if(t.side===hr?u=s.intersectTriangle(h,l,o,!0,d):u=s.intersectTriangle(o,l,h,t.side===gi,d),u===null)return null;Bn.copy(d),Bn.applyMatrix4(i.matrixWorld);let p=e.ray.origin.distanceTo(Bn);return p<e.near||p>e.far?null:{distance:p,point:Bn.clone(),object:i}}function zn(i,t,e,s,o,l,h,d,u,p){i.getVertexPosition(d,Dn),i.getVertexPosition(u,On),i.getVertexPosition(p,Fn);let m=za(i,t,e,s,Dn,On,Fn,Qs);if(m){let _=new E;ee.getBarycoord(Qs,Dn,On,Fn,_),o&&(m.uv=ee.getInterpolatedAttribute(o,d,u,p,_,new k)),l&&(m.uv1=ee.getInterpolatedAttribute(l,d,u,p,_,new k)),h&&(m.normal=ee.getInterpolatedAttribute(h,d,u,p,_,new E),m.normal.dot(s.direction)>0&&m.normal.multiplyScalar(-1));let y={a:d,b:u,c:p,normal:new E,materialIndex:0};ee.getNormal(Dn,On,Fn,y.normal),m.face=y,m.barycoord=_}return m}var gt=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){at("Curve: .getPoint() not implemented.")}getPointAt(t,e){let s=this.getUtoTmapping(t);return this.getPoint(s,e)}getPoints(t=5){let e=[];for(let s=0;s<=t;s++)e.push(this.getPoint(s/t));return e}getSpacedPoints(t=5){let e=[];for(let s=0;s<=t;s++)e.push(this.getPointAt(s/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],s,o=this.getPoint(0),l=0;e.push(0);for(let h=1;h<=t;h++)s=this.getPoint(h/t),l+=s.distanceTo(o),e.push(l),o=s;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let s=this.getLengths(),o=0,l=s.length,h;e?h=e:h=t*s[l-1];let d=0,u=l-1,p;for(;d<=u;)if(o=Math.floor(d+(u-d)/2),p=s[o]-h,p<0)d=o+1;else if(p>0)u=o-1;else{u=o;break}if(o=u,s[o]===h)return o/(l-1);let m=s[o],y=s[o+1]-m,v=(h-m)/y;return(o+v)/(l-1)}getTangent(t,e){let o=t-1e-4,l=t+1e-4;o<0&&(o=0),l>1&&(l=1);let h=this.getPoint(o),d=this.getPoint(l),u=e||(h.isVector2?new k:new E);return u.copy(d).sub(h).normalize(),u}getTangentAt(t,e){let s=this.getUtoTmapping(t);return this.getTangent(s,e)}computeFrenetFrames(t,e=!1){let s=new E,o=[],l=[],h=[],d=new E,u=new vt;for(let v=0;v<=t;v++){let S=v/t;o[v]=this.getTangentAt(S,new E)}l[0]=new E,h[0]=new E;let p=Number.MAX_VALUE,m=Math.abs(o[0].x),_=Math.abs(o[0].y),y=Math.abs(o[0].z);m<=p&&(p=m,s.set(1,0,0)),_<=p&&(p=_,s.set(0,1,0)),y<=p&&s.set(0,0,1),d.crossVectors(o[0],s).normalize(),l[0].crossVectors(o[0],d),h[0].crossVectors(o[0],l[0]);for(let v=1;v<=t;v++){if(l[v]=l[v-1].clone(),h[v]=h[v-1].clone(),d.crossVectors(o[v-1],o[v]),d.length()>Number.EPSILON){d.normalize();let S=Math.acos(K(o[v-1].dot(o[v]),-1,1));l[v].applyMatrix4(u.makeRotationAxis(d,S))}h[v].crossVectors(o[v],l[v])}if(e===!0){let v=Math.acos(K(l[0].dot(l[t]),-1,1));v/=t,o[0].dot(d.crossVectors(l[0],l[t]))>0&&(v=-v);for(let S=1;S<=t;S++)l[S].applyMatrix4(u.makeRotationAxis(o[S],v*S)),h[S].crossVectors(o[S],l[S])}return{tangents:o,normals:l,binormals:h}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},ke=class extends gt{constructor(t=0,e=0,s=1,o=1,l=0,h=Math.PI*2,d=!1,u=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=s,this.yRadius=o,this.aStartAngle=l,this.aEndAngle=h,this.aClockwise=d,this.aRotation=u}getPoint(t,e=new k){let s=e,o=Math.PI*2,l=this.aEndAngle-this.aStartAngle,h=Math.abs(l)<Number.EPSILON;for(;l<0;)l+=o;for(;l>o;)l-=o;l<Number.EPSILON&&(h?l=0:l=o),this.aClockwise===!0&&!h&&(l===o?l=-o:l=l-o);let d=this.aStartAngle+t*l,u=this.aX+this.xRadius*Math.cos(d),p=this.aY+this.yRadius*Math.sin(d);if(this.aRotation!==0){let m=Math.cos(this.aRotation),_=Math.sin(this.aRotation),y=u-this.aX,v=p-this.aY;u=y*m-v*_+this.aX,p=y*_+v*m+this.aY}return s.set(u,p)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},ei=class extends ke{constructor(t,e,s,o,l,h){super(t,e,s,s,o,l,h),this.isArcCurve=!0,this.type="ArcCurve"}};function ws(){let i=0,t=0,e=0,s=0;function o(l,h,d,u){i=l,t=d,e=-3*l+3*h-2*d-u,s=2*l-2*h+d+u}return{initCatmullRom:function(l,h,d,u,p){o(h,d,p*(d-l),p*(u-h))},initNonuniformCatmullRom:function(l,h,d,u,p,m,_){let y=(h-l)/p-(d-l)/(p+m)+(d-h)/m,v=(d-h)/m-(u-h)/(m+_)+(u-d)/_;y*=m,v*=m,o(h,d,y,v)},calc:function(l){let h=l*l,d=h*l;return i+t*l+e*h+s*d}}}var js=new E,tr=new E,Xi=new ws,Wi=new ws,Yi=new ws,He=class extends gt{constructor(t=[],e=!1,s="centripetal",o=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=s,this.tension=o}getPoint(t,e=new E){let s=e,o=this.points,l=o.length,h=(l-(this.closed?0:1))*t,d=Math.floor(h),u=h-d;this.closed?d+=d>0?0:(Math.floor(Math.abs(d)/l)+1)*l:u===0&&d===l-1&&(d=l-2,u=1);let p,m;this.closed||d>0?p=o[(d-1)%l]:(tr.subVectors(o[0],o[1]).add(o[0]),p=tr);let _=o[d%l],y=o[(d+1)%l];if(this.closed||d+2<l?m=o[(d+2)%l]:(js.subVectors(o[l-1],o[l-2]).add(o[l-1]),m=js),this.curveType==="centripetal"||this.curveType==="chordal"){let v=this.curveType==="chordal"?.5:.25,S=Math.pow(p.distanceToSquared(_),v),T=Math.pow(_.distanceToSquared(y),v),A=Math.pow(y.distanceToSquared(m),v);T<1e-4&&(T=1),S<1e-4&&(S=T),A<1e-4&&(A=T),Xi.initNonuniformCatmullRom(p.x,_.x,y.x,m.x,S,T,A),Wi.initNonuniformCatmullRom(p.y,_.y,y.y,m.y,S,T,A),Yi.initNonuniformCatmullRom(p.z,_.z,y.z,m.z,S,T,A)}else this.curveType==="catmullrom"&&(Xi.initCatmullRom(p.x,_.x,y.x,m.x,this.tension),Wi.initCatmullRom(p.y,_.y,y.y,m.y,this.tension),Yi.initCatmullRom(p.z,_.z,y.z,m.z,this.tension));return s.set(Xi.calc(u),Wi.calc(u),Yi.calc(u)),s}copy(t){super.copy(t),this.points=[];for(let e=0,s=t.points.length;e<s;e++){let o=t.points[e];this.points.push(o.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,s=this.points.length;e<s;e++){let o=this.points[e];t.points.push(o.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,s=t.points.length;e<s;e++){let o=t.points[e];this.points.push(new E().fromArray(o))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function er(i,t,e,s,o){let l=(s-t)*.5,h=(o-e)*.5,d=i*i,u=i*d;return(2*e-2*s+l+h)*u+(-3*e+3*s-2*l-h)*d+l*i+e}function Va(i,t){let e=1-i;return e*e*t}function ka(i,t){return 2*(1-i)*i*t}function Ha(i,t){return i*i*t}function sn(i,t,e,s){return Va(i,t)+ka(i,e)+Ha(i,s)}function Ga(i,t){let e=1-i;return e*e*e*t}function Xa(i,t){let e=1-i;return 3*e*e*i*t}function Wa(i,t){return 3*(1-i)*i*i*t}function Ya(i,t){return i*i*i*t}function rn(i,t,e,s,o){return Ga(i,t)+Xa(i,e)+Wa(i,s)+Ya(i,o)}var cn=class extends gt{constructor(t=new k,e=new k,s=new k,o=new k){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=s,this.v3=o}getPoint(t,e=new k){let s=e,o=this.v0,l=this.v1,h=this.v2,d=this.v3;return s.set(rn(t,o.x,l.x,h.x,d.x),rn(t,o.y,l.y,h.y,d.y)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},ni=class extends gt{constructor(t=new E,e=new E,s=new E,o=new E){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=s,this.v3=o}getPoint(t,e=new E){let s=e,o=this.v0,l=this.v1,h=this.v2,d=this.v3;return s.set(rn(t,o.x,l.x,h.x,d.x),rn(t,o.y,l.y,h.y,d.y),rn(t,o.z,l.z,h.z,d.z)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},hn=class extends gt{constructor(t=new k,e=new k){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new k){let s=e;return t===1?s.copy(this.v2):(s.copy(this.v2).sub(this.v1),s.multiplyScalar(t).add(this.v1)),s}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new k){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},ii=class extends gt{constructor(t=new E,e=new E){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new E){let s=e;return t===1?s.copy(this.v2):(s.copy(this.v2).sub(this.v1),s.multiplyScalar(t).add(this.v1)),s}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new E){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},un=class extends gt{constructor(t=new k,e=new k,s=new k){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=s}getPoint(t,e=new k){let s=e,o=this.v0,l=this.v1,h=this.v2;return s.set(sn(t,o.x,l.x,h.x),sn(t,o.y,l.y,h.y)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},si=class extends gt{constructor(t=new E,e=new E,s=new E){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=s}getPoint(t,e=new E){let s=e,o=this.v0,l=this.v1,h=this.v2;return s.set(sn(t,o.x,l.x,h.x),sn(t,o.y,l.y,h.y),sn(t,o.z,l.z,h.z)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},fn=class extends gt{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new k){let s=e,o=this.points,l=(o.length-1)*t,h=Math.floor(l),d=l-h,u=o[h===0?h:h-1],p=o[h],m=o[h>o.length-2?o.length-1:h+1],_=o[h>o.length-3?o.length-1:h+2];return s.set(er(d,u.x,p.x,m.x,_.x),er(d,u.y,p.y,m.y,_.y)),s}copy(t){super.copy(t),this.points=[];for(let e=0,s=t.points.length;e<s;e++){let o=t.points[e];this.points.push(o.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,s=this.points.length;e<s;e++){let o=this.points[e];t.points.push(o.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,s=t.points.length;e<s;e++){let o=t.points[e];this.points.push(new k().fromArray(o))}return this}},nr=Object.freeze({__proto__:null,ArcCurve:ei,CatmullRomCurve3:He,CubicBezierCurve:cn,CubicBezierCurve3:ni,EllipseCurve:ke,LineCurve:hn,LineCurve3:ii,QuadraticBezierCurve:un,QuadraticBezierCurve3:si,SplineCurve:fn}),ri=class extends gt{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let s=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new nr[s](e,t))}return this}getPoint(t,e){let s=t*this.getLength(),o=this.getCurveLengths(),l=0;for(;l<o.length;){if(o[l]>=s){let h=o[l]-s,d=this.curves[l],u=d.getLength(),p=u===0?0:1-h/u;return d.getPointAt(p,e)}l++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let s=0,o=this.curves.length;s<o;s++)e+=this.curves[s].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let s=0;s<=t;s++)e.push(this.getPoint(s/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],s;for(let o=0,l=this.curves;o<l.length;o++){let h=l[o],d=h.isEllipseCurve?t*2:h.isLineCurve||h.isLineCurve3?1:h.isSplineCurve?t*h.points.length:t,u=h.getPoints(d);for(let p=0;p<u.length;p++){let m=u[p];s&&s.equals(m)||(e.push(m),s=m)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,s=t.curves.length;e<s;e++){let o=t.curves[e];this.curves.push(o.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,s=this.curves.length;e<s;e++){let o=this.curves[e];t.curves.push(o.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,s=t.curves.length;e<s;e++){let o=t.curves[e];this.curves.push(new nr[o.type]().fromJSON(o))}return this}},me=class extends ri{constructor(t){super(),this.type="Path",this.currentPoint=new k,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,s=t.length;e<s;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let s=new hn(this.currentPoint.clone(),new k(t,e));return this.curves.push(s),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,s,o){let l=new un(this.currentPoint.clone(),new k(t,e),new k(s,o));return this.curves.push(l),this.currentPoint.set(s,o),this}bezierCurveTo(t,e,s,o,l,h){let d=new cn(this.currentPoint.clone(),new k(t,e),new k(s,o),new k(l,h));return this.curves.push(d),this.currentPoint.set(l,h),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),s=new fn(e);return this.curves.push(s),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,s,o,l,h){let d=this.currentPoint.x,u=this.currentPoint.y;return this.absarc(t+d,e+u,s,o,l,h),this}absarc(t,e,s,o,l,h){return this.absellipse(t,e,s,s,o,l,h),this}ellipse(t,e,s,o,l,h,d,u){let p=this.currentPoint.x,m=this.currentPoint.y;return this.absellipse(t+p,e+m,s,o,l,h,d,u),this}absellipse(t,e,s,o,l,h,d,u){let p=new ke(t,e,s,o,l,h,d,u);if(this.curves.length>0){let _=p.getPoint(0);_.equals(this.currentPoint)||this.lineTo(_.x,_.y)}this.curves.push(p);let m=p.getPoint(1);return this.currentPoint.copy(m),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Ge=class extends me{constructor(t){super(t),this.uuid=We(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let s=0,o=this.holes.length;s<o;s++)e[s]=this.holes[s].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,s=t.holes.length;e<s;e++){let o=t.holes[e];this.holes.push(o.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,s=this.holes.length;e<s;e++){let o=this.holes[e];t.holes.push(o.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,s=t.holes.length;e<s;e++){let o=t.holes[e];this.holes.push(new me().fromJSON(o))}return this}};function qa(i,t,e=2){let s=t&&t.length,o=s?t[0]*e:i.length,l=Cr(i,0,o,e,!0),h=[];if(!l||l.next===l.prev)return h;let d,u,p;if(s&&(l=Qa(i,t,l,e)),i.length>80*e){d=i[0],u=i[1];let m=d,_=u;for(let y=e;y<o;y+=e){let v=i[y],S=i[y+1];v<d&&(d=v),S<u&&(u=S),v>m&&(m=v),S>_&&(_=S)}p=Math.max(m-d,_-u),p=p!==0?32767/p:0}return dn(l,h,e,d,u,p,0),h}function Cr(i,t,e,s,o){let l;if(o===cl(i,t,e,s)>0)for(let h=t;h<e;h+=s)l=ir(h/s|0,i[h],i[h+1],l);else for(let h=e-s;h>=t;h-=s)l=ir(h/s|0,i[h],i[h+1],l);return l&&Xe(l,l.next)&&(mn(l),l=l.next),l}function ge(i,t){if(!i)return i;t||(t=i);let e=i,s;do if(s=!1,!e.steiner&&(Xe(e,e.next)||st(e.prev,e,e.next)===0)){if(mn(e),e=t=e.prev,e===e.next)break;s=!0}else e=e.next;while(s||e!==t);return t}function dn(i,t,e,s,o,l,h){if(!i)return;!h&&l&&il(i,s,o,l);let d=i;for(;i.prev!==i.next;){let u=i.prev,p=i.next;if(l?Ja(i,s,o,l):Za(i)){t.push(u.i,i.i,p.i),mn(i),i=p.next,d=p.next;continue}if(i=p,i===d){h?h===1?(i=$a(ge(i),t),dn(i,t,e,s,o,l,2)):h===2&&Ka(i,t,e,s,o,l):dn(ge(i),t,e,s,o,l,1);break}}}function Za(i){let t=i.prev,e=i,s=i.next;if(st(t,e,s)>=0)return!1;let o=t.x,l=e.x,h=s.x,d=t.y,u=e.y,p=s.y,m=Math.min(o,l,h),_=Math.min(d,u,p),y=Math.max(o,l,h),v=Math.max(d,u,p),S=s.next;for(;S!==t;){if(S.x>=m&&S.x<=y&&S.y>=_&&S.y<=v&&nn(o,d,l,u,h,p,S.x,S.y)&&st(S.prev,S,S.next)>=0)return!1;S=S.next}return!0}function Ja(i,t,e,s){let o=i.prev,l=i,h=i.next;if(st(o,l,h)>=0)return!1;let d=o.x,u=l.x,p=h.x,m=o.y,_=l.y,y=h.y,v=Math.min(d,u,p),S=Math.min(m,_,y),T=Math.max(d,u,p),A=Math.max(m,_,y),P=us(v,S,t,e,s),N=us(T,A,t,e,s),C=i.prevZ,I=i.nextZ;for(;C&&C.z>=P&&I&&I.z<=N;){if(C.x>=v&&C.x<=T&&C.y>=S&&C.y<=A&&C!==o&&C!==h&&nn(d,m,u,_,p,y,C.x,C.y)&&st(C.prev,C,C.next)>=0||(C=C.prevZ,I.x>=v&&I.x<=T&&I.y>=S&&I.y<=A&&I!==o&&I!==h&&nn(d,m,u,_,p,y,I.x,I.y)&&st(I.prev,I,I.next)>=0))return!1;I=I.nextZ}for(;C&&C.z>=P;){if(C.x>=v&&C.x<=T&&C.y>=S&&C.y<=A&&C!==o&&C!==h&&nn(d,m,u,_,p,y,C.x,C.y)&&st(C.prev,C,C.next)>=0)return!1;C=C.prevZ}for(;I&&I.z<=N;){if(I.x>=v&&I.x<=T&&I.y>=S&&I.y<=A&&I!==o&&I!==h&&nn(d,m,u,_,p,y,I.x,I.y)&&st(I.prev,I,I.next)>=0)return!1;I=I.nextZ}return!0}function $a(i,t){let e=i;do{let s=e.prev,o=e.next.next;!Xe(s,o)&&Ir(s,e,e.next,o)&&pn(s,o)&&pn(o,s)&&(t.push(s.i,e.i,o.i),mn(e),mn(e.next),e=i=o),e=e.next}while(e!==i);return ge(e)}function Ka(i,t,e,s,o,l){let h=i;do{let d=h.next.next;for(;d!==h.prev;){if(h.i!==d.i&&ol(h,d)){let u=Rr(h,d);h=ge(h,h.next),u=ge(u,u.next),dn(h,t,e,s,o,l,0),dn(u,t,e,s,o,l,0);return}d=d.next}h=h.next}while(h!==i)}function Qa(i,t,e,s){let o=[];for(let l=0,h=t.length;l<h;l++){let d=t[l]*s,u=l<h-1?t[l+1]*s:i.length,p=Cr(i,d,u,s,!1);p===p.next&&(p.steiner=!0),o.push(rl(p))}o.sort(ja);for(let l=0;l<o.length;l++)e=tl(o[l],e);return e}function ja(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let s=(i.next.y-i.y)/(i.next.x-i.x),o=(t.next.y-t.y)/(t.next.x-t.x);e=s-o}return e}function tl(i,t){let e=el(i,t);if(!e)return t;let s=Rr(e,i);return ge(s,s.next),ge(e,e.next)}function el(i,t){let e=t,s=i.x,o=i.y,l=-1/0,h;if(Xe(i,e))return e;do{if(Xe(i,e.next))return e.next;if(o<=e.y&&o>=e.next.y&&e.next.y!==e.y){let _=e.x+(o-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(_<=s&&_>l&&(l=_,h=e.x<e.next.x?e:e.next,_===s))return h}e=e.next}while(e!==t);if(!h)return null;let d=h,u=h.x,p=h.y,m=1/0;e=h;do{if(s>=e.x&&e.x>=u&&s!==e.x&&Pr(o<p?s:l,o,u,p,o<p?l:s,o,e.x,e.y)){let _=Math.abs(o-e.y)/(s-e.x);pn(e,i)&&(_<m||_===m&&(e.x>h.x||e.x===h.x&&nl(h,e)))&&(h=e,m=_)}e=e.next}while(e!==d);return h}function nl(i,t){return st(i.prev,i,t.prev)<0&&st(t.next,i,i.next)<0}function il(i,t,e,s){let o=i;do o.z===0&&(o.z=us(o.x,o.y,t,e,s)),o.prevZ=o.prev,o.nextZ=o.next,o=o.next;while(o!==i);o.prevZ.nextZ=null,o.prevZ=null,sl(o)}function sl(i){let t,e=1;do{let s=i,o;i=null;let l=null;for(t=0;s;){t++;let h=s,d=0;for(let p=0;p<e&&(d++,h=h.nextZ,!!h);p++);let u=e;for(;d>0||u>0&&h;)d!==0&&(u===0||!h||s.z<=h.z)?(o=s,s=s.nextZ,d--):(o=h,h=h.nextZ,u--),l?l.nextZ=o:i=o,o.prevZ=l,l=o;s=h}l.nextZ=null,e*=2}while(t>1);return i}function us(i,t,e,s,o){return i=(i-e)*o|0,t=(t-s)*o|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function rl(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Pr(i,t,e,s,o,l,h,d){return(o-h)*(t-d)>=(i-h)*(l-d)&&(i-h)*(s-d)>=(e-h)*(t-d)&&(e-h)*(l-d)>=(o-h)*(s-d)}function nn(i,t,e,s,o,l,h,d){return!(i===h&&t===d)&&Pr(i,t,e,s,o,l,h,d)}function ol(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!al(i,t)&&(pn(i,t)&&pn(t,i)&&ll(i,t)&&(st(i.prev,i,t.prev)||st(i,t.prev,t))||Xe(i,t)&&st(i.prev,i,i.next)>0&&st(t.prev,t,t.next)>0)}function st(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Xe(i,t){return i.x===t.x&&i.y===t.y}function Ir(i,t,e,s){let o=kn(st(i,t,e)),l=kn(st(i,t,s)),h=kn(st(e,s,i)),d=kn(st(e,s,t));return!!(o!==l&&h!==d||o===0&&Vn(i,e,t)||l===0&&Vn(i,s,t)||h===0&&Vn(e,i,s)||d===0&&Vn(e,t,s))}function Vn(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function kn(i){return i>0?1:i<0?-1:0}function al(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Ir(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function pn(i,t){return st(i.prev,i,i.next)<0?st(i,t,i.next)>=0&&st(i,i.prev,t)>=0:st(i,t,i.prev)<0||st(i,i.next,t)<0}function ll(i,t){let e=i,s=!1,o=(i.x+t.x)/2,l=(i.y+t.y)/2;do e.y>l!=e.next.y>l&&e.next.y!==e.y&&o<(e.next.x-e.x)*(l-e.y)/(e.next.y-e.y)+e.x&&(s=!s),e=e.next;while(e!==i);return s}function Rr(i,t){let e=fs(i.i,i.x,i.y),s=fs(t.i,t.x,t.y),o=i.next,l=t.prev;return i.next=t,t.prev=i,e.next=o,o.prev=e,s.next=e,e.prev=s,l.next=s,s.prev=l,s}function ir(i,t,e,s){let o=fs(i,t,e);return s?(o.next=s.next,o.prev=s,s.next.prev=o,s.next=o):(o.prev=o,o.next=o),o}function mn(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function fs(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function cl(i,t,e,s){let o=0;for(let l=t,h=e-s;l<e;l+=s)o+=(i[h]-i[l])*(i[l+1]+i[h+1]),h=l;return o}var ds=class{static triangulate(t,e,s=2){return qa(t,e,s)}},It=class i{static area(t){let e=t.length,s=0;for(let o=e-1,l=0;l<e;o=l++)s+=t[o].x*t[l].y-t[l].x*t[o].y;return s*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let s=[],o=[],l=[];sr(t),rr(s,t);let h=t.length;e.forEach(sr);for(let u=0;u<e.length;u++)o.push(h),h+=e[u].length,rr(s,e[u]);let d=ds.triangulate(s,o);for(let u=0;u<d.length;u+=3)l.push(d.slice(u,u+3));return l}};function sr(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function rr(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var gn=class i extends Vt{constructor(t=new Ge([new k(0,.5),new k(-.5,-.5),new k(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};let s=[],o=[],l=[],h=[],d=0,u=0;if(Array.isArray(t)===!1)p(t);else for(let m=0;m<t.length;m++)p(t[m]),this.addGroup(d,u,m),d+=u,u=0;this.setIndex(s),this.setAttribute("position",new zt(o,3)),this.setAttribute("normal",new zt(l,3)),this.setAttribute("uv",new zt(h,2));function p(m){let _=o.length/3,y=m.extractPoints(e),v=y.shape,S=y.holes;It.isClockWise(v)===!1&&(v=v.reverse());for(let A=0,P=S.length;A<P;A++){let N=S[A];It.isClockWise(N)===!0&&(S[A]=N.reverse())}let T=It.triangulateShape(v,S);for(let A=0,P=S.length;A<P;A++){let N=S[A];v=v.concat(N)}for(let A=0,P=v.length;A<P;A++){let N=v[A];o.push(N.x,N.y,0),l.push(0,0,1),h.push(N.x,N.y)}for(let A=0,P=T.length;A<P;A++){let N=T[A],C=N[0]+_,I=N[1]+_,D=N[2]+_;s.push(C,I,D),u+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes;return hl(e,t)}static fromJSON(t,e){let s=[];for(let o=0,l=t.shapes.length;o<l;o++){let h=e[t.shapes[o]];s.push(h)}return new i(s,t.curveSegments)}};function hl(i,t){if(t.shapes=[],Array.isArray(i))for(let e=0,s=i.length;e<s;e++){let o=i[e];t.shapes.push(o.uuid)}else t.shapes.push(i.uuid);return t}function Lr(i){let t={};for(let e in i){t[e]={};for(let s in i[e]){let o=i[e][s];if(or(o))o.isRenderTargetTexture?(at("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][s]=null):t[e][s]=o.clone();else if(Array.isArray(o))if(or(o[0])){let l=[];for(let h=0,d=o.length;h<d;h++)l[h]=o[h].clone();t[e][s]=l}else t[e][s]=o.slice();else t[e][s]=o}}return t}function _t(i){let t={};for(let e=0;e<i.length;e++){let s=Lr(i[e]);for(let o in s)t[o]=s[o]}return t}function or(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function De(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function qi(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var se=class{constructor(t,e,s,o){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=o!==void 0?o:new e.constructor(s),this.sampleValues=e,this.valueSize=s,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,s=this._cachedIndex,o=e[s],l=e[s-1];n:{t:{let h;e:{i:if(!(t<o)){for(let d=s+2;;){if(o===void 0){if(t<l)break i;return s=e.length,this._cachedIndex=s,this.copySampleValue_(s-1)}if(s===d)break;if(l=o,o=e[++s],t<o)break t}h=e.length;break e}if(!(t>=l)){let d=e[1];t<d&&(s=2,l=d);for(let u=s-2;;){if(l===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===u)break;if(o=l,l=e[--s-1],t>=l)break t}h=s,s=0;break e}break n}for(;s<h;){let d=s+h>>>1;t<e[d]?h=d:s=d+1}if(o=e[s],l=e[s-1],l===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(o===void 0)return s=e.length,this._cachedIndex=s,this.copySampleValue_(s-1)}this._cachedIndex=s,this.intervalChanged_(s,l,o)}return this.interpolate_(s,l,t,o)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,s=this.sampleValues,o=this.valueSize,l=t*o;for(let h=0;h!==o;++h)e[h]=s[l+h];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},oi=class extends se{constructor(t,e,s,o){super(t,e,s,o),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ss,endingEnd:ss}}intervalChanged_(t,e,s){let o=this.parameterPositions,l=t-2,h=t+1,d=o[l],u=o[h];if(d===void 0)switch(this.getSettings_().endingStart){case rs:l=t,d=2*e-s;break;case os:l=o.length-2,d=e+o[l]-o[l+1];break;default:l=t,d=s}if(u===void 0)switch(this.getSettings_().endingEnd){case rs:h=t,u=2*s-e;break;case os:h=1,u=s+o[1]-o[0];break;default:h=t-1,u=e}let p=(s-e)*.5,m=this.valueSize;this._weightPrev=p/(e-d),this._weightNext=p/(u-s),this._offsetPrev=l*m,this._offsetNext=h*m}interpolate_(t,e,s,o){let l=this.resultBuffer,h=this.sampleValues,d=this.valueSize,u=t*d,p=u-d,m=this._offsetPrev,_=this._offsetNext,y=this._weightPrev,v=this._weightNext,S=(s-e)/(o-e),T=S*S,A=T*S,P=-y*A+2*y*T-y*S,N=(1+y)*A+(-1.5-2*y)*T+(-.5+y)*S+1,C=(-1-v)*A+(1.5+v)*T+.5*S,I=v*A-v*T;for(let D=0;D!==d;++D)l[D]=P*h[m+D]+N*h[p+D]+C*h[u+D]+I*h[_+D];return l}},ai=class extends se{constructor(t,e,s,o){super(t,e,s,o)}interpolate_(t,e,s,o){let l=this.resultBuffer,h=this.sampleValues,d=this.valueSize,u=t*d,p=u-d,m=(s-e)/(o-e),_=1-m;for(let y=0;y!==d;++y)l[y]=h[p+y]*_+h[u+y]*m;return l}},li=class extends se{constructor(t,e,s,o){super(t,e,s,o)}interpolate_(t){return this.copySampleValue_(t-1)}},ci=class extends se{interpolate_(t,e,s,o){let l=this.resultBuffer,h=this.sampleValues,d=this.valueSize,u=t*d,p=u-d,m=this.inTangents,_=this.outTangents;if(!m||!_){let S=(s-e)/(o-e),T=1-S;for(let A=0;A!==d;++A)l[A]=h[p+A]*T+h[u+A]*S;return l}let y=d*2,v=t-1;for(let S=0;S!==d;++S){let T=h[p+S],A=h[u+S],P=v*y+S*2,N=_[P],C=_[P+1],I=t*y+S*2,D=m[I],B=m[I+1],z=fl(s,e,N,D,o);l[S]=Nr(z,T,C,B,A)}return l}};function Nr(i,t,e,s,o){let l=1-i;return l*l*l*t+3*l*l*i*e+3*l*i*i*s+i*i*i*o}function ul(i,t,e,s,o){let l=1-i;return 3*l*l*(e-t)+6*l*i*(s-e)+3*i*i*(o-s)}function fl(i,t,e,s,o){let l=(i-t)/(o-t);for(let h=0;h<8;h++){let d=Nr(l,t,e,s,o)-i;if(Math.abs(d)<1e-10)break;let u=ul(l,t,e,s,o);if(Math.abs(u)<1e-10)break;l=Math.max(0,Math.min(1,l-d/u))}return l}var At=class{constructor(t,e,s,o){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=De(e,this.TimeBufferType),this.values=De(s,this.ValueBufferType),this.setInterpolation(o||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,s;if(e.toJSON!==this.toJSON)s=e.toJSON(t);else{s={name:t.name,times:De(t.times,Array),values:De(t.values,Array)};let o=t.getInterpolation();o!==t.DefaultInterpolation&&(s.interpolation=o),qi(t.settings)&&(s.settings={inTangents:De(t.settings.inTangents,Array),outTangents:De(t.settings.outTangents,Array)})}return s.type=t.ValueTypeName,s}InterpolantFactoryMethodDiscrete(t){return new li(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new ai(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new oi(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new ci(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case on:e=this.InterpolantFactoryMethodDiscrete;break;case Yn:e=this.InterpolantFactoryMethodLinear;break;case Hn:e=this.InterpolantFactoryMethodSmooth;break;case is:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let s="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(s);return at("KeyframeTrack:",s),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return on;case this.InterpolantFactoryMethodLinear:return Yn;case this.InterpolantFactoryMethodSmooth:return Hn;case this.InterpolantFactoryMethodBezier:return is}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let s=0,o=e.length;s!==o;++s)e[s]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let s=0,o=e.length;s!==o;++s)e[s]*=t;qi(this.settings)&&(ar(this.settings.inTangents,t),ar(this.settings.outTangents,t))}return this}trim(t,e){let s=this.times,o=s.length,l=0,h=o-1;for(;l!==o&&s[l]<t;)++l;for(;h!==-1&&s[h]>e;)--h;if(++h,l!==0||h!==o){l>=h&&(h=Math.max(h,1),l=h-1);let d=this.getValueSize();this.times=s.slice(l,h),this.values=this.values.slice(l*d,h*d)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(it("KeyframeTrack: Invalid value size in track.",this),t=!1);let s=this.times,o=this.values,l=s.length;l===0&&(it("KeyframeTrack: Track is empty.",this),t=!1);let h=null;for(let d=0;d!==l;d++){let u=s[d];if(typeof u=="number"&&isNaN(u)){it("KeyframeTrack: Time is not a valid number.",this,d,u),t=!1;break}if(h!==null&&h>u){it("KeyframeTrack: Out of order keys.",this,d,u,h),t=!1;break}h=u}if(o!==void 0&&va(o))for(let d=0,u=o.length;d!==u;++d){let p=o[d];if(isNaN(p)){it("KeyframeTrack: Value is not a valid number.",this,d,p),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),s=this.getValueSize(),o=this.getInterpolation()===Hn,l=t.length-1,h=1;for(let d=1;d<l;++d){let u=!1,p=t[d],m=t[d+1];if(p!==m&&(d!==1||p!==t[0]))if(o)u=!0;else{let _=d*s,y=_-s,v=_+s;for(let S=0;S!==s;++S){let T=e[_+S];if(T!==e[y+S]||T!==e[v+S]){u=!0;break}}}if(u){if(d!==h){t[h]=t[d];let _=d*s,y=h*s;for(let v=0;v!==s;++v)e[y+v]=e[_+v]}++h}}if(l>0){t[h]=t[l];for(let d=l*s,u=h*s,p=0;p!==s;++p)e[u+p]=e[d+p];++h}return h!==t.length?(this.times=t.slice(0,h),this.values=e.slice(0,h*s)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),s=this.constructor,o=new s(this.name,t,e);return o.createInterpolant=this.createInterpolant,qi(this.settings)&&(o.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),o}};function ar(i,t){for(let e=0,s=i.length;e!==s;e+=2)i[e]*=t}At.prototype.ValueTypeName="";At.prototype.TimeBufferType=Float32Array;At.prototype.ValueBufferType=Float32Array;At.prototype.DefaultInterpolation=Yn;var re=class extends At{constructor(t,e,s){super(t,e,s)}};re.prototype.ValueTypeName="bool";re.prototype.ValueBufferType=Array;re.prototype.DefaultInterpolation=on;re.prototype.InterpolantFactoryMethodLinear=void 0;re.prototype.InterpolantFactoryMethodSmooth=void 0;var hi=class extends At{constructor(t,e,s,o){super(t,e,s,o)}};hi.prototype.ValueTypeName="color";var ui=class extends At{constructor(t,e,s,o){super(t,e,s,o)}};ui.prototype.ValueTypeName="number";var fi=class extends se{constructor(t,e,s,o){super(t,e,s,o)}interpolate_(t,e,s,o){let l=this.resultBuffer,h=this.sampleValues,d=this.valueSize,u=(s-e)/(o-e),p=t*d;for(let m=p+d;p!==m;p+=4)qt.slerpFlat(l,0,h,p-d,h,p,u);return l}},_n=class extends At{constructor(t,e,s,o){super(t,e,s,o)}InterpolantFactoryMethodLinear(t){return new fi(this.times,this.values,this.getValueSize(),t)}};_n.prototype.ValueTypeName="quaternion";_n.prototype.InterpolantFactoryMethodSmooth=void 0;var oe=class extends At{constructor(t,e,s){super(t,e,s)}};oe.prototype.ValueTypeName="string";oe.prototype.ValueBufferType=Array;oe.prototype.DefaultInterpolation=on;oe.prototype.InterpolantFactoryMethodLinear=void 0;oe.prototype.InterpolantFactoryMethodSmooth=void 0;var di=class extends At{constructor(t,e,s,o){super(t,e,s,o)}};di.prototype.ValueTypeName="vector";var pi=class{constructor(t,e,s){let o=this,l=!1,h=0,d=0,u,p=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=s,this._abortController=null,this.itemStart=function(m){d++,l===!1&&o.onStart!==void 0&&o.onStart(m,h,d),l=!0},this.itemEnd=function(m){h++,o.onProgress!==void 0&&o.onProgress(m,h,d),h===d&&(l=!1,o.onLoad!==void 0&&o.onLoad())},this.itemError=function(m){o.onError!==void 0&&o.onError(m)},this.resolveURL=function(m){return m=m.normalize("NFC"),u?u(m):m},this.setURLModifier=function(m){return u=m,this},this.addHandler=function(m,_){return p.push(m,_),this},this.removeHandler=function(m){let _=p.indexOf(m);return _!==-1&&p.splice(_,2),this},this.getHandler=function(m){for(let _=0,y=p.length;_<y;_+=2){let v=p[_],S=p[_+1];if(v.global&&(v.lastIndex=0),v.test(m))return S}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Dr=new pi,mi=class{constructor(t){this.manager=t!==void 0?t:Dr,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let s=this;return new Promise(function(o,l){s.load(t,o,e,l)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};mi.DEFAULT_MATERIAL_NAME="__DEFAULT";var Cs="\\[\\]\\.:\\/",dl=new RegExp("["+Cs+"]","g"),Ps="[^"+Cs+"]",pl="[^"+Cs.replace("\\.","")+"]",ml=/((?:WC+[\/:])*)/.source.replace("WC",Ps),gl=/(WCOD+)?/.source.replace("WCOD",pl),_l=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ps),xl=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ps),yl=new RegExp("^"+ml+gl+_l+xl+"$"),vl=["material","materials","bones","map"],ps=class{constructor(t,e,s){let o=s||nt.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,o)}getValue(t,e){this.bind();let s=this._targetGroup.nCachedObjects_,o=this._bindings[s];o!==void 0&&o.getValue(t,e)}setValue(t,e){let s=this._bindings;for(let o=this._targetGroup.nCachedObjects_,l=s.length;o!==l;++o)s[o].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,s=t.length;e!==s;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,s=t.length;e!==s;++e)t[e].unbind()}},nt=class i{constructor(t,e,s){this.path=e,this.parsedPath=s||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,s){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,s):new i(t,e,s)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(dl,"")}static parseTrackName(t){let e=yl.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let s={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},o=s.nodeName&&s.nodeName.lastIndexOf(".");if(o!==void 0&&o!==-1){let l=s.nodeName.substring(o+1);vl.indexOf(l)!==-1&&(s.nodeName=s.nodeName.substring(0,o),s.objectName=l)}if(s.propertyName===null||s.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return s}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let s=t.skeleton.getBoneByName(e);if(s!==void 0)return s}if(t.children){let s=function(l){for(let h=0;h<l.length;h++){let d=l[h];if(d.name===e||d.uuid===e)return d;let u=s(d.children);if(u)return u}return null},o=s(t.children);if(o)return o}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let s=this.resolvedProperty;for(let o=0,l=s.length;o!==l;++o)t[e++]=s[o]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let s=this.resolvedProperty;for(let o=0,l=s.length;o!==l;++o)s[o]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let s=this.resolvedProperty;for(let o=0,l=s.length;o!==l;++o)s[o]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let s=this.resolvedProperty;for(let o=0,l=s.length;o!==l;++o)s[o]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,s=e.objectName,o=e.propertyName,l=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){at("PropertyBinding: No target node found for track: "+this.path+".");return}if(s){let p=e.objectIndex;switch(s){case"materials":if(!t.material){it("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){it("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){it("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let m=0;m<t.length;m++)if(t[m].name===p){p=m;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){it("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){it("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[s]===void 0){it("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[s]}if(p!==void 0){if(t[p]===void 0){it("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[p]}}let h=t[o];if(h===void 0){let p=e.nodeName;it("PropertyBinding: Trying to update property for track: "+p+"."+o+" but it wasn't found.",t);return}let d=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?d=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(d=this.Versioning.MatrixWorldNeedsUpdate);let u=this.BindingType.Direct;if(l!==void 0){if(o==="morphTargetInfluences"){if(!t.geometry){it("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){it("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[l]!==void 0&&(l=t.morphTargetDictionary[l])}u=this.BindingType.ArrayElement,this.resolvedProperty=h,this.propertyIndex=l}else h.fromArray!==void 0&&h.toArray!==void 0?(u=this.BindingType.HasFromToArray,this.resolvedProperty=h):Array.isArray(h)?(u=this.BindingType.EntireArray,this.resolvedProperty=h):this.propertyName=o;this.getValue=this.GetterByBindingType[u],this.setValue=this.SetterByBindingTypeAndVersioning[u][d]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};nt.Composite=ps;nt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};nt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};nt.prototype.GetterByBindingType=[nt.prototype._getValue_direct,nt.prototype._getValue_array,nt.prototype._getValue_arrayElement,nt.prototype._getValue_toArray];nt.prototype.SetterByBindingTypeAndVersioning=[[nt.prototype._setValue_direct,nt.prototype._setValue_direct_setNeedsUpdate,nt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[nt.prototype._setValue_array,nt.prototype._setValue_array_setNeedsUpdate,nt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[nt.prototype._setValue_arrayElement,nt.prototype._setValue_arrayElement_setNeedsUpdate,nt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[nt.prototype._setValue_fromArray,nt.prototype._setValue_fromArray_setNeedsUpdate,nt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Cu=new Float32Array(1);var ms=class i{static{i.prototype.isMatrix2=!0}constructor(t,e,s,o){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,s,o)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let s=0;s<4;s++)this.elements[s]=t[s+e];return this}set(t,e,s,o){let l=this.elements;return l[0]=t,l[2]=e,l[1]=s,l[3]=o,this}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?at("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");var wl=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Cl=`#ifdef USE_ALPHAHASH
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
#endif`,Pl=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Il=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Rl=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ll=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Nl=`#ifdef USE_AOMAP
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
#endif`,Dl=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Ol=`#ifdef USE_BATCHING
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
#endif`,Fl=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Ul=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Bl=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,zl=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Vl=`#ifdef USE_IRIDESCENCE
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
#endif`,kl=`#ifdef USE_BUMPMAP
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
#endif`,Hl=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Gl=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Xl=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Wl=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Yl=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,ql=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Zl=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Jl=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,$l=`#define PI 3.141592653589793
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
} // validated`,Kl=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Ql=`vec3 transformedNormal = objectNormal;
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
#endif`,jl=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,tc=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,ec=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,nc=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ic="gl_FragColor = linearToOutputTexel( gl_FragColor );",sc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,rc=`#ifdef USE_ENVMAP
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
#endif`,oc=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,ac=`#ifdef USE_ENVMAP
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
#endif`,lc=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,cc=`#ifdef USE_ENVMAP
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
#endif`,hc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,uc=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,dc=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,pc=`#ifdef USE_GRADIENTMAP
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
}`,mc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,gc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,_c=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,xc=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,yc=`#ifdef USE_ENVMAP
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
#endif`,vc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Sc=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Mc=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,bc=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Tc=`PhysicalMaterial material;
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
#endif`,Ec=`uniform sampler2D dfgLUT;
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
}`,Ac=`
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
#endif`,wc=`#if defined( RE_IndirectDiffuse )
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
#endif`,Cc=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Pc=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,Ic=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Rc=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Lc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Nc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Dc=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Oc=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Fc=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Uc=`#if defined( USE_POINTS_UV )
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
#endif`,Bc=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,zc=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Vc=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,kc=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Hc=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Gc=`#ifdef USE_MORPHTARGETS
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
#endif`,Xc=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Wc=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Yc=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,qc=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Zc=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Jc=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,$c=`#ifdef USE_NORMALMAP
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
#endif`,Kc=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Qc=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,jc=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,th=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,eh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,nh=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,ih=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,sh=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,rh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,oh=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,ah=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,lh=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,ch=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,hh=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,uh=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,fh=`float getShadowMask() {
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
}`,dh=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,ph=`#ifdef USE_SKINNING
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
#endif`,mh=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,gh=`#ifdef USE_SKINNING
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
#endif`,_h=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,xh=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,yh=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,vh=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,Sh=`#ifdef USE_TRANSMISSION
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
#endif`,Mh=`#ifdef USE_TRANSMISSION
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
#endif`,bh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Th=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Eh=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,Ah=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,wh=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Ch=`uniform sampler2D t2D;
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
}`,Ph=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Ih=`#ifdef ENVMAP_TYPE_CUBE
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
}`,Rh=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Lh=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Nh=`#include <common>
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
}`,Dh=`#if DEPTH_PACKING == 3200
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
}`,Oh=`#define DISTANCE
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
}`,Fh=`#define DISTANCE
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
}`,Uh=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Bh=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zh=`uniform float scale;
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
}`,Vh=`uniform vec3 diffuse;
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
}`,kh=`#include <common>
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
}`,Hh=`uniform vec3 diffuse;
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
}`,Gh=`#define LAMBERT
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
}`,Xh=`#define LAMBERT
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
}`,Wh=`#define MATCAP
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
}`,Yh=`#define MATCAP
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
}`,qh=`#define NORMAL
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
}`,Zh=`#define NORMAL
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
}`,Jh=`#define PHONG
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
}`,$h=`#define PHONG
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
}`,Kh=`#define STANDARD
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
}`,Qh=`#define STANDARD
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
}`,jh=`#define TOON
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
}`,tu=`#define TOON
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
}`,eu=`uniform float size;
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
}`,nu=`uniform vec3 diffuse;
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
}`,iu=`#include <common>
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
}`,su=`uniform vec3 color;
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
}`,ru=`uniform float rotation;
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
}`,ou=`uniform vec3 diffuse;
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
}`,Q={alphahash_fragment:wl,alphahash_pars_fragment:Cl,alphamap_fragment:Pl,alphamap_pars_fragment:Il,alphatest_fragment:Rl,alphatest_pars_fragment:Ll,aomap_fragment:Nl,aomap_pars_fragment:Dl,batching_pars_vertex:Ol,batching_vertex:Fl,begin_vertex:Ul,beginnormal_vertex:Bl,bsdfs:zl,iridescence_fragment:Vl,bumpmap_pars_fragment:kl,clipping_planes_fragment:Hl,clipping_planes_pars_fragment:Gl,clipping_planes_pars_vertex:Xl,clipping_planes_vertex:Wl,color_fragment:Yl,color_pars_fragment:ql,color_pars_vertex:Zl,color_vertex:Jl,common:$l,cube_uv_reflection_fragment:Kl,defaultnormal_vertex:Ql,displacementmap_pars_vertex:jl,displacementmap_vertex:tc,emissivemap_fragment:ec,emissivemap_pars_fragment:nc,colorspace_fragment:ic,colorspace_pars_fragment:sc,envmap_fragment:rc,envmap_common_pars_fragment:oc,envmap_pars_fragment:ac,envmap_pars_vertex:lc,envmap_physical_pars_fragment:yc,envmap_vertex:cc,fog_vertex:hc,fog_pars_vertex:uc,fog_fragment:fc,fog_pars_fragment:dc,gradientmap_pars_fragment:pc,lightmap_pars_fragment:mc,lights_lambert_fragment:gc,lights_lambert_pars_fragment:_c,lights_pars_begin:xc,lights_toon_fragment:vc,lights_toon_pars_fragment:Sc,lights_phong_fragment:Mc,lights_phong_pars_fragment:bc,lights_physical_fragment:Tc,lights_physical_pars_fragment:Ec,lights_fragment_begin:Ac,lights_fragment_maps:wc,lights_fragment_end:Cc,lightprobes_pars_fragment:Pc,logdepthbuf_fragment:Ic,logdepthbuf_pars_fragment:Rc,logdepthbuf_pars_vertex:Lc,logdepthbuf_vertex:Nc,map_fragment:Dc,map_pars_fragment:Oc,map_particle_fragment:Fc,map_particle_pars_fragment:Uc,metalnessmap_fragment:Bc,metalnessmap_pars_fragment:zc,morphinstance_vertex:Vc,morphcolor_vertex:kc,morphnormal_vertex:Hc,morphtarget_pars_vertex:Gc,morphtarget_vertex:Xc,normal_fragment_begin:Wc,normal_fragment_maps:Yc,normal_pars_fragment:qc,normal_pars_vertex:Zc,normal_vertex:Jc,normalmap_pars_fragment:$c,clearcoat_normal_fragment_begin:Kc,clearcoat_normal_fragment_maps:Qc,clearcoat_pars_fragment:jc,iridescence_pars_fragment:th,opaque_fragment:eh,packing:nh,premultiplied_alpha_fragment:ih,project_vertex:sh,dithering_fragment:rh,dithering_pars_fragment:oh,roughnessmap_fragment:ah,roughnessmap_pars_fragment:lh,shadowmap_pars_fragment:ch,shadowmap_pars_vertex:hh,shadowmap_vertex:uh,shadowmask_pars_fragment:fh,skinbase_vertex:dh,skinning_pars_vertex:ph,skinning_vertex:mh,skinnormal_vertex:gh,specularmap_fragment:_h,specularmap_pars_fragment:xh,tonemapping_fragment:yh,tonemapping_pars_fragment:vh,transmission_fragment:Sh,transmission_pars_fragment:Mh,uv_pars_fragment:bh,uv_pars_vertex:Th,uv_vertex:Eh,worldpos_vertex:Ah,background_vert:wh,background_frag:Ch,backgroundCube_vert:Ph,backgroundCube_frag:Ih,cube_vert:Rh,cube_frag:Lh,depth_vert:Nh,depth_frag:Dh,distance_vert:Oh,distance_frag:Fh,equirect_vert:Uh,equirect_frag:Bh,linedashed_vert:zh,linedashed_frag:Vh,meshbasic_vert:kh,meshbasic_frag:Hh,meshlambert_vert:Gh,meshlambert_frag:Xh,meshmatcap_vert:Wh,meshmatcap_frag:Yh,meshnormal_vert:qh,meshnormal_frag:Zh,meshphong_vert:Jh,meshphong_frag:$h,meshphysical_vert:Kh,meshphysical_frag:Qh,meshtoon_vert:jh,meshtoon_frag:tu,points_vert:eu,points_frag:nu,shadow_vert:iu,shadow_frag:su,sprite_vert:ru,sprite_frag:ou},U={common:{diffuse:{value:new ot(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new q},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new q}},envmap:{envMap:{value:null},envMapRotation:{value:new q},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new q}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new q}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new q},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new q},normalScale:{value:new k(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new q},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new q}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new q}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new q}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ot(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new E},probesMax:{value:new E},probesResolution:{value:new E}},points:{diffuse:{value:new ot(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0},uvTransform:{value:new q}},sprite:{diffuse:{value:new ot(16777215)},opacity:{value:1},center:{value:new k(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new q},alphaMap:{value:null},alphaMapTransform:{value:new q},alphaTest:{value:0}}},Or={basic:{uniforms:_t([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.fog]),vertexShader:Q.meshbasic_vert,fragmentShader:Q.meshbasic_frag},lambert:{uniforms:_t([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.fog,U.lights,{emissive:{value:new ot(0)},envMapIntensity:{value:1}}]),vertexShader:Q.meshlambert_vert,fragmentShader:Q.meshlambert_frag},phong:{uniforms:_t([U.common,U.specularmap,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.fog,U.lights,{emissive:{value:new ot(0)},specular:{value:new ot(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Q.meshphong_vert,fragmentShader:Q.meshphong_frag},standard:{uniforms:_t([U.common,U.envmap,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.roughnessmap,U.metalnessmap,U.fog,U.lights,{emissive:{value:new ot(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Q.meshphysical_vert,fragmentShader:Q.meshphysical_frag},toon:{uniforms:_t([U.common,U.aomap,U.lightmap,U.emissivemap,U.bumpmap,U.normalmap,U.displacementmap,U.gradientmap,U.fog,U.lights,{emissive:{value:new ot(0)}}]),vertexShader:Q.meshtoon_vert,fragmentShader:Q.meshtoon_frag},matcap:{uniforms:_t([U.common,U.bumpmap,U.normalmap,U.displacementmap,U.fog,{matcap:{value:null}}]),vertexShader:Q.meshmatcap_vert,fragmentShader:Q.meshmatcap_frag},points:{uniforms:_t([U.points,U.fog]),vertexShader:Q.points_vert,fragmentShader:Q.points_frag},dashed:{uniforms:_t([U.common,U.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Q.linedashed_vert,fragmentShader:Q.linedashed_frag},depth:{uniforms:_t([U.common,U.displacementmap]),vertexShader:Q.depth_vert,fragmentShader:Q.depth_frag},normal:{uniforms:_t([U.common,U.bumpmap,U.normalmap,U.displacementmap,{opacity:{value:1}}]),vertexShader:Q.meshnormal_vert,fragmentShader:Q.meshnormal_frag},sprite:{uniforms:_t([U.sprite,U.fog]),vertexShader:Q.sprite_vert,fragmentShader:Q.sprite_frag},background:{uniforms:{uvTransform:{value:new q},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Q.background_vert,fragmentShader:Q.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new q}},vertexShader:Q.backgroundCube_vert,fragmentShader:Q.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Q.cube_vert,fragmentShader:Q.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Q.equirect_vert,fragmentShader:Q.equirect_frag},distance:{uniforms:_t([U.common,U.displacementmap,{referencePosition:{value:new E},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Q.distance_vert,fragmentShader:Q.distance_frag},shadow:{uniforms:_t([U.lights,U.fog,{color:{value:new ot(0)},opacity:{value:1}}]),vertexShader:Q.shadow_vert,fragmentShader:Q.shadow_frag}};Or.physical={uniforms:_t([Or.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new q},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new q},clearcoatNormalScale:{value:new k(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new q},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new q},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new q},sheen:{value:0},sheenColor:{value:new ot(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new q},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new q},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new q},transmissionSamplerSize:{value:new k},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new q},attenuationDistance:{value:0},attenuationColor:{value:new ot(0)},specularColor:{value:new ot(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new q},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new q},anisotropyVector:{value:new k},anisotropyMap:{value:null},anisotropyMapTransform:{value:new q}}]),vertexShader:Q.meshphysical_vert,fragmentShader:Q.meshphysical_frag};var au=new q;au.set(-1,0,0,0,1,0,0,0,1);var M0={[_s]:"LINEAR_TONE_MAPPING",[xs]:"REINHARD_TONE_MAPPING",[ys]:"CINEON_TONE_MAPPING",[vs]:"ACES_FILMIC_TONE_MAPPING",[Ms]:"AGX_TONE_MAPPING",[bs]:"NEUTRAL_TONE_MAPPING",[Ss]:"CUSTOM_TONE_MAPPING"};var b0=new Float32Array(16),T0=new Float32Array(9),E0=new Float32Array(4);var A0={[_s]:"Linear",[xs]:"Reinhard",[ys]:"Cineon",[vs]:"ACESFilmic",[Ms]:"AgX",[bs]:"Neutral",[Ss]:"Custom"};var w0={[lr]:"SHADOWMAP_TYPE_PCF",[cr]:"SHADOWMAP_TYPE_VSM"};var C0={[_r]:"ENVMAP_TYPE_CUBE",[Es]:"ENVMAP_TYPE_CUBE",[xr]:"ENVMAP_TYPE_CUBE_UV"};var P0={[Es]:"ENVMAP_MODE_REFRACTION"};var I0={[gs]:"ENVMAP_BLENDING_MULTIPLY",[mr]:"ENVMAP_BLENDING_MIX",[gr]:"ENVMAP_BLENDING_ADD"};var lu=new q;lu.set(-1,0,0,0,1,0,0,0,1);var R0=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);var Fr=Object.freeze({version:1,zero:1e-9,topology:1e-7,contact:1e-6,angular:1e-6,relativeVolume:1e-8,minVolume:1e-8,microMax:.01,microMin:1e-5}),N0=Object.freeze([0,Fr.contact]);var cu=new WeakMap;function xe(i){return i?cu.get(i)||i.attributes.position:void 0}function Ur(i){let t=i.clone(),e=xe(i);return t.setAttribute("position",e.clone()),t}function hu(i,t){let e=i.points,s=t==="start"?0:e.length-1,o=e[s],l=e[t==="start"?1:s-1],h=t==="start"?l[0]-o[0]:o[0]-l[0],d=t==="start"?l[1]-o[1]:o[1]-l[1],u=Math.hypot(h,d);return{point:o,angle:i.tangents?.[t]??Math.atan2(d,h)*180/Math.PI,length:u,handleLength:i.tangentLengths?.[t]??u/3}}function uu(i){let t=new He(i.points.map(l=>new E(...l,0)),!!i.closed,"centripetal");if(i.closed||!["start","end"].some(l=>Number.isFinite(i.tangents?.[l])||Number.isFinite(i.tangentLengths?.[l])))return t;let e=i.points.length-1,s={};for(let l of["start","end"])if(Number.isFinite(i.tangents?.[l])||Number.isFinite(i.tangentLengths?.[l])){let{angle:h,handleLength:d}=hu(i,l),u=h*Math.PI/180,p=i.points,m=l==="start"?new E(p[1][0]-p[0][0],p[1][1]-p[0][1],0):new E(p.at(-1)[0]-p.at(-2)[0],p.at(-1)[1]-p.at(-2)[1],0);s[l]=new E(Math.cos(u)*d*3,Math.sin(u)*d*3,0).sub(m)}let o=new gt;return o.getPoint=(l,h=new E)=>{t.getPoint(l,h);let d=l*e;if(s.start&&d<=1&&h.addScaledVector(s.start,d*(1-d)*(1-d)),s.end&&d>=e-1){let u=d-(e-1);h.addScaledVector(s.end,u*u*(u-1))}return h},o}function Br(i){return i.points.length<2?i.points.map(t=>[...t]):uu(i).getPoints(Math.max(32,i.points.length*16)).map(t=>[t.x,t.y])}var du=bi(xi(),1);function St(i){return i.frame?Object.fromEntries(["u","v","n"].map(t=>[t,new E(...i.frame[t])])):i.plane==="XZ"?{u:new E(1,0,0),v:new E(0,0,-1),n:new E(0,1,0)}:i.plane==="YZ"?{u:new E(0,0,-1),v:new E(0,1,0),n:new E(1,0,0)}:{u:new E(1,0,0),v:new E(0,1,0),n:new E(0,0,1)}}function yi(i){if(!i||["u","v","n"].some(o=>!Array.isArray(i[o])||i[o].length!==3||i[o].some(l=>!Number.isFinite(l))))throw Error("\u4F5C\u56F3\u5E73\u9762\u304C\u4E0D\u6B63\u3067\u3059");let{u:t,v:e,n:s}=St({frame:i});if([t,e,s].some(o=>Math.abs(o.length()-1)>1e-5)||t.clone().cross(e).distanceTo(s)>1e-5)throw Error("\u4F5C\u56F3\u5E73\u9762\u306E\u8EF8\u304C\u4E0D\u6B63\u3067\u3059")}function zr(i){let t=St(i);return new vt().makeBasis(t.u,t.v,t.n)}var ae=bi(xi(),1),ut=1e-6,vi=1e5,Ye=(i,t)=>i[0]*t[1]-i[1]*t[0],Jt=(i,t)=>[i[0]-t[0],i[1]-t[1]],ye=(i,t)=>i[0]*t[0]+i[1]*t[1],Is=i=>i.reduce((t,e,s)=>t+Ye(e,i[(s+1)%i.length]),0)/2;function pu(i,t){let e=!1;for(let s=0,o=t.length-1;s<t.length;o=s++){let l=t[s],h=t[o];l[1]>i[1]!=h[1]>i[1]&&i[0]<(h[0]-l[0])*(i[1]-l[1])/(h[1]-l[1])+l[0]&&(e=!e)}return e}function Rs(i){if(i.frame){let t=St(i),e=new E(i.x,i.y,i.z);return{u:e.dot(t.u),v:e.dot(t.v),offset:e.dot(t.n)}}return i.plane==="XY"?{u:i.x,v:i.y,offset:i.z}:i.plane==="XZ"?{u:i.x,v:-i.z,offset:i.y}:{u:-i.z,v:i.y,offset:i.x}}function mu(i){if(i.profile==="point"){let h=Rs(i);return[[h.u,h.v]]}let t=[];if(i.profile==="polyline"){let h=i.points.map(d=>[...d]);return i.closed&&h.push([...h[0]]),h}if(i.profile==="spline")return Br(i);if(i.profile==="line")t.push([-i.width/2,0],[i.width/2,0]);else if(i.profile==="rect")t.push([-i.width/2,-i.height/2],[i.width/2,-i.height/2],[i.width/2,i.height/2],[-i.width/2,i.height/2],[-i.width/2,-i.height/2]);else if(i.profile==="circle")for(let h=0;h<=128;h++)t.push([Math.cos(h*Math.PI/64)*i.diameter/2,Math.sin(h*Math.PI/64)*i.diameter/2]);let e=i.angle*Math.PI/180,s=Math.cos(e),o=Math.sin(e),l=Rs(i);return t.map(([h,d])=>[l.u+h*s-d*o,l.v+h*o+d*s])}var Ls=i=>Math.round(i[0]/ut)+","+Math.round(i[1]/ut),Vr=(i,t)=>[i.a[0]+(i.b[0]-i.a[0])*t,i.a[1]+(i.b[1]-i.a[1])*t];function gu(i,t){let e=Jt(i.b,i.a),s=Jt(t.b,t.a),o=Jt(t.a,i.a),l=Ye(e,s);if(Math.abs(l)>1e-10){let h=Ye(o,s)/l,d=Ye(o,e)/l;h>=-ut&&h<=1+ut&&d>=-ut&&d<=1+ut&&(i.ts.push(Math.max(0,Math.min(1,h))),t.ts.push(Math.max(0,Math.min(1,d))))}else if(Math.abs(Ye(o,e))<ut*Math.sqrt(ye(e,e))){for(let h of[t.a,t.b]){let d=ye(Jt(h,i.a),e)/ye(e,e);d>0&&d<1&&i.ts.push(d)}for(let h of[i.a,i.b]){let d=ye(Jt(h,t.a),s)/ye(s,s);d>0&&d<1&&t.ts.push(d)}}}function _u(i){let t=i.map(m=>({...m,ts:[0,1],minX:Math.min(m.a[0],m.b[0]),maxX:Math.max(m.a[0],m.b[0]),minY:Math.min(m.a[1],m.b[1]),maxY:Math.max(m.a[1],m.b[1])})).sort((m,_)=>m.minX-_.minX),e=[];for(let m of t){e=e.filter(_=>_.maxX>=m.minX-ut);for(let _ of e)_.maxY>=m.minY-ut&&_.minY<=m.maxY+ut&&gu(_,m);e.push(m)}let s=new Map,o=new Map,l=m=>{let _=Ls(m);return s.has(_)||s.set(_,{key:_,p:m,neighbors:new Set}),s.get(_)};for(let m of t){m.ts.sort((_,y)=>_-y);for(let _=1;_<m.ts.length;_++){let y=l(Vr(m,m.ts[_-1])),v=l(Vr(m,m.ts[_]));if(y.key===v.key)continue;let S=[y.key,v.key].sort().join("|");o.has(S)||(o.set(S,[y,v]),y.neighbors.add(v),v.neighbors.add(y))}}let h=0,d=[];for(let m of s.values()){if(m.disc)continue;m.disc=m.low=++h;let _=[{n:m,parent:null,next:[...m.neighbors],i:0}];for(;_.length;){let y=_.at(-1);if(y.i<y.next.length){let v=y.next[y.i++];if(v===y.parent)continue;v.disc?y.n.low=Math.min(y.n.low,v.disc):(v.disc=v.low=++h,_.push({n:v,parent:y.n,next:[...v.neighbors],i:0}))}else _.pop(),y.parent&&(y.parent.low=Math.min(y.parent.low,y.n.low),y.n.low>y.parent.disc&&d.push([y.n,y.parent]))}}for(let[m,_]of d)m.neighbors.delete(_),_.neighbors.delete(m);for(let m of s.values())m.order=[...m.neighbors].sort((_,y)=>Math.atan2(_.p[1]-m.p[1],_.p[0]-m.p[0])-Math.atan2(y.p[1]-m.p[1],y.p[0]-m.p[0]));let u=new Set,p=[];for(let m of s.values())for(let _ of m.order){let y=m,v=_,S=[],T=m.key+">"+_.key;if(!u.has(T)){for(let A=0;A<o.size*2+2;A++){let P=y.key+">"+v.key;if(u.has(P))break;u.add(P),S.push(y.p);let N=v.order,C=N.indexOf(y),I=N[(C-1+N.length)%N.length];if(y=v,v=I,y===m&&v===_)break}y===m&&v===_&&S.length>=3&&Is(S)>1e-7&&p.push(S)}}return p}function xu(i){let t=i[0],e=i[1],s=Jt(e,t),o=Math.hypot(...s),l=Math.min(o*1e-5,1e-4);return[(t[0]+e[0])/2-s[1]/o*l,(t[1]+e[1])/2+s[0]/o*l]}function yu(i){let t=2166136261;for(let e=0;e<i.length;e++)t=Math.imul(t^i.charCodeAt(e),16777619);return(t>>>0).toString(36)}function kr(i){let t=i.map(Ls),e=t.reduce((s,o,l)=>o<t[s]?l:s,0);return[...t.slice(e),...t.slice(0,e)].join(";")}function vu(i){let t=new Set,e=!1;for(let u of i)for(let p of u){let m=Ls(p);t.has(m)&&(e=!0),t.add(m)}if(!e)return i;let s=new Map,o=i.map(u=>{let p=u.map(m=>{let _=Math.round(m[0]*vi),y=Math.round(m[1]*vi);return s.set(_+","+y,m),{X:_,Y:y}});return ae.default.Clipper.Orientation(p)||p.reverse(),p}),l=new ae.default.Clipper;l.StrictlySimple=!0,l.PreserveCollinear=!0,l.AddPaths(o,ae.default.PolyType.ptSubject,!0);let h=new ae.default.PolyTree;l.Execute(ae.default.ClipType.ctUnion,h,ae.default.PolyFillType.pftNonZero,ae.default.PolyFillType.pftNonZero);let d=[];for(let u=h.GetFirst();u;u=u.GetNext())u.IsHole()||d.push(u.Contour().map(({X:p,Y:m})=>s.get(p+","+m)||[p/vi,m/vi]));return d}function Gr(i){let t=new Set(i.filter(o=>o.textOutline?.hole===!0&&typeof o.textOutline.id=="string").map(o=>o.id)),e=new Map;for(let o of i.filter(l=>l.kind==="sketch"&&!l.construction)){let l=St(o),h=Rs(o),d=l.n.clone(),u=d.toArray(),p=u.reduce((T,A,P)=>Math.abs(A)>Math.abs(u[T])?P:T,0);u[p]<0&&d.negate();let m=h.offset*l.n.dot(d),_=d.toArray().map(T=>Math.round(T/ut)).join(",")+":"+Math.round(m/ut);if(!e.has(_)){let T="CUSTOM",A;for(let P of["XY","XZ","YZ"])St({plane:P}).n.distanceTo(d)<ut&&(T=P);if(T==="CUSTOM"){let P=Math.abs(d.z)<.9?new E(0,0,1):new E(0,1,0),N=P.cross(d).normalize(),C=d.clone().cross(N);A={u:N.toArray(),v:C.toArray(),n:d.toArray()}}e.set(_,{plane:T,frame:A,offset:m,segments:[],sourceIds:[]})}let y=e.get(_),v=St(y),S=mu(o).map(([T,A])=>{let P=l.u.clone().multiplyScalar(T).addScaledVector(l.v,A).addScaledVector(l.n,h.offset);return[P.dot(v.u),P.dot(v.v)]});y.sourceIds.push(o.id);for(let T=1;T<S.length;T++)Math.hypot(...Jt(S[T],S[T-1]))>ut&&y.segments.push({a:S[T-1],b:S[T],sourceId:o.id})}let s=[];for(let[o,l]of e){if(l.segments.length>2e4)throw Error("\u30B9\u30B1\u30C3\u30C1\u304C\u8907\u96D1\u3059\u304E\u307E\u3059\u3002\u7DDA\u306E\u6570\u3092\u6E1B\u3089\u3057\u3066\u304F\u3060\u3055\u3044\u3002");let d=_u(l.segments).map(u=>({outer:u,holes:[],area:Is(u),parent:null}));for(let u of d){let p=xu(u.outer),m=d.filter(_=>_.area>u.area+ut&&pu(p,_.outer));m.length&&(u.parent=m.sort((_,y)=>_.area-y.area)[0],u.parent.holes.push(u.outer))}for(let u of d){u.holes=vu(u.holes);let p=u.area-u.holes.reduce((m,_)=>m+Math.abs(Is(_)),0);if(!(p<1e-6)){if(t.size){let m=Hr({outer:u.outer,holes:[]},l.segments);if(m.length&&m.every(_=>t.has(_)))continue}s.push({id:o+":"+yu(kr(u.outer)+u.holes.map(kr).sort().join("/")),plane:l.plane,frame:l.frame,offset:l.offset,outer:u.outer,holes:u.holes,area:p,sourceIds:Hr(u,l.segments)})}}}return s}function Su(i){if(!i||!["XY","XZ","YZ","CUSTOM"].includes(i.plane)||!Number.isFinite(i.offset)||Math.abs(i.offset)>1e4||!Array.isArray(i.outer)||!Array.isArray(i.holes)||i.holes.length>150)throw Error("\u9818\u57DF\u30C7\u30FC\u30BF\u304C\u4E0D\u6B63\u3067\u3059\u3002");i.plane==="CUSTOM"&&yi(i.frame);let t=0;for(let e of[i.outer,...i.holes])if(!Array.isArray(e)||e.length<3||(t+=e.length)>2e4||e.some(s=>!Array.isArray(s)||s.length!==2||s.some(o=>!Number.isFinite(o)||Math.abs(o)>25e3)))throw Error("\u8F2A\u90ED\u30C7\u30FC\u30BF\u304C\u4E0D\u6B63\u3067\u3059\u3002");return i}function Mu(i){let t=new Ge(i.outer.map(e=>new k(...e)));for(let e of i.holes)t.holes.push(new me(e.map(s=>new k(...s))));return t}function bu(i,t){if(t.frame){let e=St(t);return i.applyMatrix4(zr(t)),i.translate(...e.n.multiplyScalar(t.offset).toArray()),i}return t.plane==="XZ"&&i.rotateX(-Math.PI/2),t.plane==="YZ"&&i.rotateY(Math.PI/2),t.plane==="XY"?i.translate(0,0,t.offset):t.plane==="XZ"?i.translate(0,t.offset,0):i.translate(t.offset,0,0),i}function Xr(i){return Su(i),bu(new gn(Mu(i)),i)}function Hr(i,t){let e=new Set;for(let s of[i.outer,...i.holes])for(let o=0;o<s.length;o++){let l=s[o],h=s[(o+1)%s.length],d=[(l[0]+h[0])/2,(l[1]+h[1])/2];for(let u of t){let p=Jt(u.b,u.a),m=Jt(d,u.a),_=ye(p,p),y=ye(m,p)/_;y>=-ut&&y<=1+ut&&Math.abs(Ye(m,p))<=ut*Math.sqrt(_)&&e.add(u.sourceId)}}return[...e].sort()}var rt=bi(xi(),1);function Si(i,t,{precision:e=!1}={}){let s=t.normal,o=new E(Math.abs(s.x)<.9?1:0,Math.abs(s.x)<.9?0:1,0);o.addScaledVector(s,-o.dot(s)).normalize();let l=s.clone().cross(o),h=[],d=new Map,u=new Set,p=1e-5;function m(C){let I=new E(...C),D=new k(I.dot(o),I.dot(l)),B=Math.floor(D.x/p),z=Math.floor(D.y/p),O=-1,X=p*p;for(let j=-1;j<=1;j++)for(let W=-1;W<=1;W++)for(let tt of d.get(B+j+","+(z+W))||[]){let Y=h[tt].p.distanceToSquared(D);Y<=X&&(O=tt,X=Y)}if(O>=0)return O;let V=h.length,H=B+","+z;return h.push({p:D,links:new Set}),d.has(H)||d.set(H,[]),d.get(H).push(V),V}for(let C=0;C<i.length;C+=6){let I=m(i.slice(C,C+3)),D=m(i.slice(C+3,C+6)),B=Math.min(I,D)+","+Math.max(I,D);I===D||u.has(B)||(u.add(B),h[I].links.add(D),h[D].links.add(I))}let _=h.flatMap((C,I)=>C.links.size<2?[I]:[]);for(;_.length;){let C=_.pop(),I=h[C];if(!(I.links.size>1)){for(let D of I.links)h[D].links.delete(C),h[D].links.size===1&&_.push(D);I.links.clear()}}let y=h.map(C=>[...C.links].sort((I,D)=>Math.atan2(h[I].p.y-C.p.y,h[I].p.x-C.p.x)-Math.atan2(h[D].p.y-C.p.y,h[D].p.x-C.p.x))),v=new Set,S=[];for(let C=0;C<h.length;C++)for(let I of y[C]){if(v.has(C+","+I))continue;let D=C,B=I,z=!1,O=[];for(let W=0;W<=u.size*2;W++){let tt=D+","+B;if(v.has(tt)){z=D===C&&B===I;break}v.add(tt),O.push(h[D].p);let Y=y[B],ct=Y.indexOf(D),ft=Y[(ct+Y.length-1)%Y.length];D=B,B=ft}let X=It.area(O);if(!z||O.length<3||X<=1e-12)continue;let V=It.triangulateShape(O,[]),H=null,j=0;for(let[W,tt,Y]of V){let ct=Math.abs((O[tt].x-O[W].x)*(O[Y].y-O[W].y)-(O[tt].y-O[W].y)*(O[Y].x-O[W].x));ct>j&&(j=ct,H=O[W].clone().add(O[tt]).add(O[Y]).multiplyScalar(1/3))}H&&S.push({points:O,area:X,sample:H})}let T=(C,I)=>{let D=!1;for(let B=0,z=I.length-1;B<I.length;z=B++){let O=I[B],X=I[z];O.y>C.y!=X.y>C.y&&C.x<(X.x-O.x)*(C.y-O.y)/(X.y-O.y)+O.x&&(D=!D)}return D},A=S.map(C=>S.filter(I=>I.area>C.area&&T(C.sample,I.points)).length),P=[];for(let C=0;C<S.length;C++){if(A[C]%2)continue;let I=S[C].points,D=S.filter((z,O)=>A[O]===A[C]+1&&T(z.sample,I)).map(z=>z.points),B=[I,...D].flat();for(let z of It.triangulateShape(I,D))for(let O of z){let X=B[O];P.push(...o.clone().multiplyScalar(X.x).addScaledVector(l,X.y).addScaledVector(s,-t.constant).toArray())}}let N=new Vt;return N.setAttribute("position",e?new Et(new Float64Array(P),3):new zt(P,3)),N.computeVertexNormals(),N}function Wr(i,t){let e=xe(i),s=i.index,o=[],l=s?s.count:e.count;for(let h=0;h<l;h+=3){let d=[0,1,2].map(_=>new E().fromBufferAttribute(e,s?s.getX(h+_):h+_)),u=d.map(_=>{let y=t.distanceToPoint(_);return Math.abs(y)<1e-7?0:y}),p=[];if(u.every(_=>_===0))continue;for(let _=0;_<3;_++){let y=(_+1)%3;u[_]===0?p.push(d[_]):u[_]*u[y]<0&&p.push(d[_].clone().lerp(d[y],u[_]/(u[_]-u[y])))}let m=p.filter((_,y)=>!p.slice(0,y).some(v=>v.distanceToSquared(_)<1e-12));m.length===2&&o.push(...m[0].toArray(),...m[1].toArray())}return o}var ve=1e5;function xn(i,t=!0){let e=i.map(([s,o])=>({X:Math.round(s*ve),Y:Math.round(o*ve)}));return rt.default.Clipper.Orientation(e)!==t&&e.reverse(),e}function Eu(i,t,e,{nativeSegments:s=null,heal:o=!0}={}){let l=[];for(let u of i){if(!u.visible)continue;u.updateWorldMatrix(!0,!1);let p=Ur(u.geometry).applyMatrix4(u.matrixWorld),m=new pe(t.n,-e),_=Wr(p,m),y=Si(_,m,{precision:p.attributes.position.array instanceof Float64Array});if(s)for(let v=0;v<_.length;v+=6){let S=new E(..._.slice(v,v+3)),T=new E(..._.slice(v+3,v+6));s.push([[S.dot(t.u),S.dot(t.v)],[T.dot(t.u),T.dot(t.v)]])}try{for(let v of[p,y]){let S=v.attributes.position,T=v.index;for(let A=0;A<(T?.count??S.count);A+=3){let P=[0,1,2].map(C=>new E().fromBufferAttribute(S,T?T.getX(A+C):A+C));if(P.some(C=>Math.abs(m.distanceToPoint(C))>1e-4))continue;let N=xn(P.map(C=>[C.dot(t.u),C.dot(t.v)]));Math.abs(rt.default.Clipper.Area(N))>1&&l.push(N)}}}finally{y.dispose(),p.dispose()}}let h=new rt.default.Clipper;h.AddPaths(l,rt.default.PolyType.ptSubject,!0);let d=[];if(h.Execute(rt.default.ClipType.ctUnion,d,rt.default.PolyFillType.pftNonZero,rt.default.PolyFillType.pftNonZero),o)for(let u of[20,-20]){let p=new rt.default.ClipperOffset(2),m=[];p.AddPaths(d,rt.default.JoinType.jtMiter,rt.default.EndType.etClosedPolygon),p.Execute(m,u),d=m}return d}function Yr(i,t,{includeOutside:e=!1,includeUnsplit:s=!1}={}){let o=[],l=new Map;for(let h of i){let d=St(h),u=[...d.n.toArray(),h.offset,...d.u.toArray(),...d.v.toArray()].join(",");if(!l.has(u)){let y=Eu(t,d,h.offset);l.set(u,y)}let p=l.get(u);if(!p.length&&!s)continue;let m=["inside",...e?["outside"]:[]].map(y=>{let v=new rt.default.Clipper,S=new rt.default.PolyTree;return v.AddPaths([xn(h.outer),...h.holes.map(T=>xn(T,!1))],rt.default.PolyType.ptSubject,!0),v.AddPaths(p,rt.default.PolyType.ptClip,!0),v.Execute(y==="outside"?rt.default.ClipType.ctDifference:rt.default.ClipType.ctIntersection,S,rt.default.PolyFillType.pftNonZero,rt.default.PolyFillType.pftNonZero),{tree:S,side:y}}),_=[];for(let{tree:y,side:v}of m){let S=0;for(let T=y.GetFirst();T;T=T.GetNext()){if(T.IsHole())continue;let A=T.Contour().map(V=>[V.X/ve,V.Y/ve]),P=T.Childs().filter(V=>V.IsHole()).map(V=>V.Contour().map(H=>[H.X/ve,H.Y/ve])),N=(Math.abs(rt.default.Clipper.Area(T.Contour()))-T.Childs().filter(V=>V.IsHole()).reduce((V,H)=>V+Math.abs(rt.default.Clipper.Area(H.Contour())),0))/ve**2;if(N<1e-5||!s&&Math.abs(N-h.area)<Math.max(1e-4,h.area*1e-6))continue;let C=A.map(V=>new k(...V)),I=P.map(V=>V.map(H=>new k(...H))),D=[...A,...P.flat()],z=It.triangulateShape(C,I).sort((V,H)=>Math.abs(rt.default.Clipper.Area(xn(H.map(j=>D[j]))))-Math.abs(rt.default.Clipper.Area(xn(V.map(j=>D[j])))))[0];if(!z)continue;let O=z.reduce((V,H)=>[V[0]+D[H][0]/3,V[1]+D[H][1]/3],[0,0]),X=d.u.clone().multiplyScalar(O[0]).addScaledVector(d.v,O[1]).addScaledVector(d.n,h.offset).toArray();_.push({...h,id:h.id+(v==="outside"?":outside:":":overlap:")+S++,outer:A,holes:P,area:N,partitionSide:v,overlapSource:structuredClone(h),overlapPoint:X,overlapTargets:[...new Set(t.filter(V=>V.visible).map(V=>V.userData.bodyId))]})}}for(let y of _)o.push({...y,partitionCount:_.filter(v=>v.partitionSide===y.partitionSide).length})}return o}function qr({features:i,bodies:t=[]}){let e=[];try{for(let h of t){let d=new Vt().setAttribute("position",new Et(new Float64Array(h.positions),3));h.indices&&d.setIndex(h.indices);let u=new Ve(d);u.matrixAutoUpdate=!1,u.matrix.fromArray(h.matrix),u.updateMatrixWorld(!0),e.push(u)}let s=Gr(i),o=Yr(s,e,{includeOutside:!0}),l=[...s,...o].map(h=>{let d=Xr(h);try{return{id:h.id,positions:d.attributes.position.array.slice(),indices:d.index?.array.slice()||null}}finally{d.dispose()}});return{regions:s,overlap:o,faces:l}}finally{for(let s of e)s.geometry.dispose(),s.material.dispose()}}self.onmessage=({data:i})=>{try{self.postMessage({id:i.id,result:qr(i.spec)})}catch(t){self.postMessage({id:i.id,error:t.message||String(t)})}};
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
