import { createContext, useContext } from "react";

export interface ConversationDetailsContextValue {
  available: boolean;
  open: boolean;
  close: () => void;
  toggle: () => void;
}

const unavailableConversationDetails: ConversationDetailsContextValue = {
  available: false,
  open: false,
  close: () => undefined,
  toggle: () => undefined,
};

export const ConversationDetailsContext =
  createContext<ConversationDetailsContextValue>(
    unavailableConversationDetails
  );

export function useConversationDetailsContext() {
  return useContext(ConversationDetailsContext);
}
