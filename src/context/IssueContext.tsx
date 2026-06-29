import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Issue } from '../lib/types';

interface IssueContextType {
  issues: Issue[];
  addIssue: (issue: Issue) => void;
}

const IssueContext = createContext<IssueContextType | undefined>(undefined);

export const IssueProvider: React.FC< { children: ReactNode }> = ({ children }) => {
  const [issues, setIssues] = useState<Issue[]>([]);

  const addIssue = (issue: Issue) => {
    setIssues((prevIssues) => [issue, ...prevIssues]);
  };

  return (
    <IssueContext.Provider value={{ issues, addIssue }}>
      {children}
    </IssueContext.Provider>
  );
};

export const useIssues = () => {
  const context = useContext(IssueContext);
  if (context === undefined) {
    throw new Error('useIssues must be used within an IssueProvider');
  }
  return context;
};
