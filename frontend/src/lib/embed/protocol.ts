// The wire format is owned by the loader package so the two halves of the
// channel can never drift. Re-exported here so app code keeps importing from
// '@/lib/embed/protocol'.
export * from '@human.tech/shield-embed/protocol'
