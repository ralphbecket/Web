var Od;(function(n){function tt(){var t=this,u=t.obs(),i=t.dom,f=i&&i.parentNode,r;e(i,null);r=n.patchDom(u,i,f);e(r,t);t.dom=r}var t=!0,r,i;n.text=function(n){return{text:s(n)?"":n.toString()}};n.element=function(n,t,i){n=n.toUpperCase();var r=c(t),u=i?o(i)?i:[i]:null;return{tag:n,props:r,children:u}};n.component=function(n){var i=Obs.isObservable(n)?n:Obs.fn(n),t={obs:i,subs:null,dom:null},r=Obs.subscribe([i],tt.bind(t));return t.subs=r,r(),t};var o=function(n){return n instanceof Array},s=function(n){return n===null||n===undefined},h=[],c=function(n){var t,i;if(!n)return null;var r=[],u=Object.keys(n).sort(),f=u.length;for(t=0;t<f;t++)i=u[t],r.push(i,n[i]);return r};n.patchDom=function(t,i,r){var u=typeof t=="string"?n.text(t):t;return u.tag?v(u,i,r):u.obs?a(u,i,r):l(u,i,r)};var l=function(n,t,r){var f=n.text,u=!t||t.nodeName!=="#text"?document.createTextNode(f):t;return u.textContent!==f&&(u.textContent=f),i(u,t,r),u},a=function(n,t,r){var u=n.dom;return u!==t&&i(u,t,r),u},v=function(n,r,u){var o=n.tag,s=n.props,h=n.children,f=r,e=!f||f.tagName!==o||y(f)?document.createElement(o):f;return t&&e!==f&&console.log("Created",o),k(e,s),g(e,h),i(e,r,u),e},y=function(n){return!!nt(n)},p=[],w=function(n){return n.__Od__props},b=function(n,t){n.__Od__props=t},k=function(n,t){var e=w(n),o,s,c;if(t||e){e||(e=p);t||(t=h);for(var r=0,i=0,a=e.length,v=t.length,l=[];r<a&&i<v;)o=e[r],s=t[i],o<s?(u(n,o),r+=1):(c=t[i+1],f(n,s,c,l),i+=2,r+=o===s?1:0);while(r<a)o=e[r],u(n,o),r+=1;while(i<v)s=t[i],c=t[i+1],f(n,s,c,l),i+=2;b(n,l)}},u=function(n,t){n[t]=undefined;n instanceof HTMLElement&&n.removeAttribute(t)},f=function(n,t,i,r){n[t]=i;r.push(t)},d=[],g=function(r,u){var o=r.childNodes,h,s,f,c,e;for(u||(u=d),h=o.length,s=u.length,f=h-1;s<=f;f--)e=o[f],i(null,e,r),t&&console.log("Removed child",f+1);for(f=0;f<s;f++)t&&console.log("Patching child",f+1),c=u[f],e=o[f],n.patchDom(c,e,r),t&&console.log("Patched child",f+1)},nt=function(n){return n.__Od__component},e=function(n,t){n&&(n.__Od__component=t)};r=[];i=function(n,i,u){if(n)if(i){if(n===i)return;if(t&&console.log("Deleted",i.nodeName||"#text"),r.push(i),!u)return;t&&console.log("Inserted",n.nodeName||"#text");u&&u.replaceChild(n,i)}else t&&console.log("Inserted",n.nodeName||"#text"),u&&u.appendChild(n);else{if(!i)return;t&&console.log("Deleted",i.nodeName||"#text");r.push(i);u&&u.removeChild(i)}}})(Od||(Od={}));