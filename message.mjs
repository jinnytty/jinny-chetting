const timeReg = /<t:\d*>/g;
const smilieReg = /<a?:(.*?):\d*>/g;

export function format(msg, maxLength) {
  let result = '';
  console.log('message to format', msg);
  let lines = msg.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();

    if (l.length == 0) continue;

    if (l.startsWith('<t:')) {
      continue;
    }

    result =
      result + ' ' + l.replaceAll(smilieReg, '$1').replaceAll(timeReg, '');

    if (result.length > maxLength) break;
  }
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3).trim();
    result += '...';
  }
  return result;
}
