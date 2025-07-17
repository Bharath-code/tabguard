import React, { useState, useEffect } from 'react';
import { UserProfile, UserConfig } from '@/shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ProfileManagerProps {
  profiles: UserProfile[];
  currentConfig: UserConfig;
  onProfilesChange: (profiles: UserProfile[]) => void;
  onProfileActivate: (profile: UserProfile) => void;
  className?: string;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({
  profiles = [],
  currentConfig,
  onProfilesChange,
  onProfileActivate,
  className = ''
}) => {
  const [localProfiles, setLocalProfiles] = useState<UserProfile[]>(profiles);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isAddingProfile, setIsAddingProfile] = useState<boolean>(false);

  useEffect(() => {
    setLocalProfiles(profiles);
  }, [profiles]);

  const handleProfileActivate = (profileId: string) => {
    const profile = localProfiles.find(p => p.id === profileId);
    if (!profile) return;
    
    // Update all profiles to set isActive to false except the selected one
    const updatedProfiles = localProfiles.map(p => ({
      ...p,
      isActive: p.id === profileId
    }));
    
    setLocalProfiles(updatedProfiles);
    onProfilesChange(updatedProfiles);
    onProfileActivate(profile);
  };

  const handleProfileDelete = (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      const updatedProfiles = localProfiles.filter(p => p.id !== profileId);
      setLocalProfiles(updatedProfiles);
      onProfilesChange(updatedProfiles);
    }
  };

  const handleProfileEdit = (profile: UserProfile) => {
    setEditingProfile({ ...profile });
    setIsAddingProfile(false);
  };

  const handleAddNewProfile = () => {
    const newProfile: UserProfile = {
      id: uuidv4(),
      name: 'New Profile',
      config: { ...currentConfig },
      isActive: false
    };
    
    setEditingProfile(newProfile);
    setIsAddingProfile(true);
  };

  const handleProfileSave = () => {
    if (!editingProfile) return;
    
    let updatedProfiles: UserProfile[];
    
    if (isAddingProfile) {
      updatedProfiles = [...localProfiles, editingProfile];
    } else {
      updatedProfiles = localProfiles.map(profile => 
        profile.id === editingProfile.id ? editingProfile : profile
      );
    }
    
    setLocalProfiles(updatedProfiles);
    onProfilesChange(updatedProfiles);
    setEditingProfile(null);
    setIsAddingProfile(false);
  };

  const handleProfileCancel = () => {
    setEditingProfile(null);
    setIsAddingProfile(false);
  };

  const handleProfileNameChange = (name: string) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, name });
  };

  return (
    <div className={`profile-manager ${className}`}>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">User Profiles</h3>
        <button
          onClick={handleAddNewProfile}
          className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Add New Profile
        </button>
      </div>
      
      {localProfiles.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-md">
          <p className="text-gray-500 dark:text-gray-400">
            No profiles defined yet. Profiles allow you to switch between different tab management configurations.
          </p>
          <button
            onClick={handleAddNewProfile}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Create Your First Profile
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {localProfiles.map(profile => (
            <div 
              key={profile.id}
              className={`rounded-md border p-3 ${
                profile.isActive 
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`font-medium ${profile.isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {profile.name}
                  </span>
                  {profile.isActive && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {!profile.isActive && (
                    <button
                      onClick={() => handleProfileActivate(profile.id)}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => handleProfileEdit(profile)}
                    className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Edit profile"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleProfileDelete(profile.id)}
                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete profile"
                    disabled={profile.isActive}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                    Tab Limit: {profile.config.tabLimit}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                    Theme: {profile.config.theme}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                    Rules: {profile.config.rules.length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Profile Editor Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {isAddingProfile ? 'Add New Profile' : 'Edit Profile'}
              </h3>
              
              <div className="space-y-4">
                {/* Profile Name */}
                <div>
                  <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Profile Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={editingProfile.name}
                    onChange={(e) => handleProfileNameChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white"
                    placeholder="Enter profile name"
                  />
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {isAddingProfile 
                      ? 'This profile will be created with your current settings. You can activate it later to switch to this configuration.'
                      : 'Editing a profile name only. To modify the profile settings, activate it first and then adjust your settings.'}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={handleProfileCancel}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProfileSave}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {isAddingProfile ? 'Add Profile' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileManager;