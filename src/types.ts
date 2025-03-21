export type SignProtocolAttestation = {
  attestTimestamp: number
  attestationId: string
  attester: string
  chainId: string
  chainType: string
  data: string
  dataLocation: string
  from: string
  fullSchemaId: string
  id: string
  indexingValue: string
  isReceiver: boolean
  isSender: boolean
  linkedAttestation: string
  mode: string
  recipients: Array<string>
  revokeReason: null | any
  revokeTimestamp: null | any
  revokeTransactionHash: string
  revoked: boolean
  schema: {
    description: string
    id: string
    name: string
    schemaId: string
  },
  schemaId: string
  transactionHash: string
  validUntil: string
}

export type SignProtocolAttestationsQueryResponse = {
  data: {
    page: number
    rows: Array<SignProtocolAttestation>
    size: number
    total: number
  }
  message: string
  statusCode: number
  success: boolean
}

export type CleanHandsSBTAztec = {
  id: bigint
  recipient: AztecAddress
  expiry: bigint
  action_id: bigint
  action_nullifier: bigint
  revoked: boolean
  minter: AztecAddress
}
