// Script-data boundary scanner for these HTML fixtures, not a general HTML DOM parser.
// Implements the data/escaped/double-escaped transitions from WHATWG 13.2.5.15–31.
// https://html.spec.whatwg.org/multipage/parsing.html#script-data-double-escape-start-state
function scripts(html){html=html.replace(/\r\n?/g,'\n');const out=[],open=/<script\b[^>]*>/gi;let match;while((match=open.exec(html))){const start=open.lastIndex;let state='data',end=-1,after=-1;for(let i=start;i<html.length;i++){
 const rest=html.slice(i),tag=rest.match(/^<(\/?)script(?=[\t\n\f />])/i);
 if(state!=='data'&&rest.startsWith('-->')){state='data';i+=2;continue;}
 if(state==='data'&&rest.startsWith('<!--')){state='escaped';i+=3;continue;}
 if(!tag)continue;
 if(state==='double'){if(tag[1]){state='escaped';i+=tag[0].length;}continue;}
 if(tag[1]){end=i;after=html.indexOf('>',i)+1;break;}
 if(state==='escaped'){state='double';i+=tag[0].length;}
 }if(end<0)throw Error('Unterminated script under script-data rules');out.push({source:html.slice(start,end),tag:match[0]});open.lastIndex=after;}return out;}
module.exports={scripts};
