
type TmsgStatuses =
  'sending to server'
  | 'sent to server'
  | 'delivered'
  | 'failed to send to server'
  | 'recipient is offline'
  | 'server did not receive the message'
  | 'failed to open file'
type TMessagesWithStates = {
  msg: string,
  status: TmsgStatuses
  msgHash: string
}

export type {
  TmsgStatuses,
  TMessagesWithStates
}

