import React from 'react';

interface QuickActionsProps {
  onOpenSettings: () => void;
  onCloseSuggested?: () => void;
  hasSuggestions: boolean;
  onCloseAllDuplicates?: () => void;
  onCloseInactiveTabs?: () => void;
  onGroupTabsByDomain?: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ 
  onOpenSettings, 
  onCloseSuggested, 
  hasSuggestions,
  onCloseAllDuplicates = () => console.log('Close duplicates clicked'),
  onCloseInactiveTabs = () => console.log('Close inactive tabs clicked'),
  onGroupTabsByDomain = () => console.log('Group tabs clicked')
}) => {
  // Button styles
  const buttonBaseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    transition: 'all 200ms',
    cursor: 'pointer',
    border: '1px solid #e5e7eb',
  };
  
  const secondaryButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#f9fafb',
    color: '#111827',
    border: '1px solid #e5e7eb',
  };
  
  const primaryButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
  };
  
  const disabledButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    cursor: 'not-allowed',
    border: '1px solid #e5e7eb',
  };
  
  const iconStyle = {
    width: '16px',
    height: '16px',
    marginRight: '4px',
  };
  
  const gridContainerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '8px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
        Quick Actions
      </h2>
      
      <div style={gridContainerStyle}>
        <button
          onClick={onCloseAllDuplicates}
          style={secondaryButtonStyle}
          title="Close duplicate tabs"
        >
          <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Close Duplicates
        </button>
        
        <button
          onClick={onCloseInactiveTabs}
          style={secondaryButtonStyle}
          title="Close tabs that haven't been used in a while"
        >
          <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Close Inactive
        </button>
      </div>
      
      <button
        onClick={onGroupTabsByDomain}
        style={{...secondaryButtonStyle, marginBottom: '8px'}}
        title="Group tabs by website domain"
      >
        <svg style={iconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Group Tabs by Domain
      </button>
      
      <button
        onClick={onCloseSuggested}
        style={{...secondaryButtonStyle, marginBottom: '8px'}}
      >
        <svg style={{...iconStyle, marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Smart Suggestions
      </button>
      
      <div style={{
        borderTop: '1px solid #e5e7eb',
        paddingTop: '8px',
      }}>
        <button
          onClick={onOpenSettings}
          style={{...primaryButtonStyle, width: '100%'}}
        >
          <svg style={{...iconStyle, marginRight: '8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
};

export default QuickActions;