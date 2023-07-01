import { TMessagesWithStates, TmsgStatuses } from './types-definitions';

export default function UpdateMsgStatus(msgId: string, status: TmsgStatuses, msgMap: Map<string, TMessagesWithStates>) {
  console.log('updated status for msg ', msgId, ' to ', status)

  const msg = msgMap.get(msgId);
  if(!msg) {
    console.log('invalid msg_id: ', msgId)
    return msgMap;
  }
  msg.status = status;
  msgMap.set(msgId, msg);
  return msgMap
}