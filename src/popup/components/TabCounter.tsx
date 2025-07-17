import React from 'react';

interface TabCounterProps {
  currentCount: number;
  tabLimit: number;
}

const TabCounter: React.FC<TabCounterProps> = ({ currentCount, tabLimit }) => {
  const isNearLimit = currentCount >= tabLimit * 0.8;
  const isAtLimit = currentCount >= tabLimit;
  
  // Calculate progress percentage
  const progressPercentage = Math.min(100, (currentCount / tabLimit) * 100);
  
  // Determine status text and colors
  let statusText = '';
  let progressColor = '#22c55e'; // green-500
  let containerStyle = {
    backgroundColor: '#f9fafb', // gray-100
    borderColor: '#e5e7eb', // gray-200
  };
  let statusTextStyle = {
    color: '#16a34a', // green-600
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
  
  if (isAtLimit) {
    statusText = 'Tab limit reached!';
    progressColor = '#ef4444'; // red-500
    containerStyle = {
      backgroundColor: '#fee2e2', // red-100
      borderColor: '#fecaca', // red-200
    };
    statusTextStyle = {
      ...statusTextStyle,
      color: '#dc2626', // red-600
    };
  } else if (isNearLimit) {
    statusText = 'Approaching limit';
    progressColor = '#f59e0b'; // amber-500
    containerStyle = {
      backgroundColor: '#fefce8', // yellow-50
      borderColor: '#fef08a', // yellow-200
    };
    statusTextStyle = {
      ...statusTextStyle,
      color: '#d97706', // amber-600
    };
  } else {
    statusText = 'Tab usage healthy';
  }

  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '16px', 
      borderRadius: '0.5rem',
      border: '1px solid',
      ...containerStyle
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '4px' 
      }}>
        <span style={{ 
          fontSize: '0.875rem', 
          fontWeight: 500, 
          color: '#374151' // gray-700
        }}>
          Open Tabs
        </span>
        <span style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold' 
        }}>
          {currentCount} / {tabLimit}
        </span>
      </div>
      
      {/* Progress bar */}
      <div style={{ 
        width: '100%', 
        backgroundColor: '#e5e7eb', // gray-200
        borderRadius: '9999px', 
        height: '10px', 
        marginBottom: '8px' 
      }}>
        <div 
          style={{ 
            width: `${progressPercentage}%`, 
            backgroundColor: progressColor, 
            height: '10px', 
            borderRadius: '9999px',
            transition: 'all 300ms ease-in-out'
          }}
        ></div>
      </div>
      
      <div style={statusTextStyle}>
        {isAtLimit && (
          <svg 
            style={{ width: '16px', height: '16px', marginRight: '4px' }} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        )}
        {statusText}
      </div>
    </div>
  );
};

export default TabCounter;