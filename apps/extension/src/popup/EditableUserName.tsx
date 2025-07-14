import React, { useState, useCallback } from "react";

interface EditableUserNameProps {
  currentName: string;
  onRename: (newName: string) => Promise<void>;
  disabled?: boolean;
  isCurrentUser?: boolean;
}

export const EditableUserName: React.FC<EditableUserNameProps> = ({
  currentName,
  onRename,
  disabled = false,
  isCurrentUser = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleStartEdit = useCallback(() => {
    if (disabled || !isCurrentUser) return;
    setIsEditing(true);
    setNewName(currentName);
    setError("");
  }, [currentName, disabled, isCurrentUser]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setNewName(currentName);
    setError("");
  }, [currentName]);

  const handleSave = useCallback(async () => {
    const trimmedName = newName.trim();

    // Validation
    if (!trimmedName) {
      setError("User name cannot be empty");
      return;
    }

    if (trimmedName.length < 2) {
      setError("User name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 30) {
      setError("User name must be less than 30 characters");
      return;
    }

    if (trimmedName === currentName) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onRename(trimmedName);
      setIsEditing(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to rename user",
      );
    } finally {
      setIsLoading(false);
    }
  }, [newName, currentName, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const handleBlur = useCallback(() => {
    // Save on blur unless user hit escape
    if (isEditing && !error) {
      handleSave();
    }
  }, [isEditing, error, handleSave]);

  if (isEditing) {
    return (
      <div className="flex-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isLoading}
          className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your name..."
          autoFocus
          maxLength={30}
        />
        {error && <div className="text-red-600 text-xs mt-1">{error}</div>}
      </div>
    );
  }

  return (
    <span
      className={`${
        isCurrentUser && !disabled
          ? "cursor-pointer hover:bg-gray-50 hover:text-blue-700 px-1 py-0.5 -mx-1 -my-0.5 rounded transition-colors"
          : ""
      }`}
      onClick={isCurrentUser && !disabled ? handleStartEdit : undefined}
      title={
        isCurrentUser && !disabled ? "Click to rename yourself" : undefined
      }
    >
      {currentName}
    </span>
  );
};
