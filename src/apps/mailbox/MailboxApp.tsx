import React from 'react';
import { useSimulationMailbox } from '../../store/useBoundedSimulationRead';
import { MailboxView } from './MailboxView';

/** Legacy synchronous entry. Worker UI imports MailboxView only. */
export const MailboxApp: React.FC = () => {
  const mailbox = useSimulationMailbox();
  return <MailboxView mailbox={mailbox} />;
};
