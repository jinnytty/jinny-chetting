const timeReg = /<t:\d*>/g;
const smilieReg = /<a?:(.*?):\d*>/g;

export function format(msg, maxLength){
  let result = '';
  console.log('message to format',msg);
  let lines = msg.split('\n');
  for(let i=0;i<lines.length;i++){
    const l = lines[i].trim();
    
    if (l.length==0) continue;
    if (l.search(timeReg)>-1) {
      continue;
    }
    if (l[0] == '>') {
      continue;
    }

    result = result + ' ' + l.replaceAll(smilieReg,'$1');
        

    if (result.length>maxLength) break;
  }
  if (result.length>maxLength) {
    result = result.substring(0,250).trim();
    result += '...';
  }
  return result;
}