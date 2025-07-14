import React, { useState, useCallback } from "react";

interface EditableRoomNameProps {
  currentName: string;
  onRename: (newName: string) => Promise<void>;
  disabled?: boolean;
}

export const EditableRoomName: React.FC<EditableRoomNameProps> = ({
  currentName,
  onRename,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleStartEdit = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setNewName(currentName);
    setError("");
  }, [currentName, disabled]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setNewName(currentName);
    setError("");
  }, [currentName]);

  const handleSave = useCallback(async () => {
    const trimmedName = newName.trim();

    // Validation
    if (!trimmedName) {
      setError("Room name cannot be empty");
      return;
    }

    if (trimmedName.length < 3) {
      setError("Room name must be at least 3 characters");
      return;
    }

    if (trimmedName.length > 50) {
      setError("Room name must be less than 50 characters");
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
        error instanceof Error ? error.message : "Failed to rename room",
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
          className="w-full text-lg font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter room name..."
          autoFocus
          maxLength={50}
        />
        {error && <div className="text-red-600 text-xs mt-1">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center flex-1">
      <h3
        className={`font-medium text-gray-900 flex-1 ${
          !disabled
            ? "cursor-pointer hover:bg-gray-50 hover:text-blue-700 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
            : ""
        }`}
        onClick={!disabled ? handleStartEdit : undefined}
        title={!disabled ? "Click to rename room" : undefined}
      >
        {currentName}
      </h3>
    </div>
  );
};
