/**
 * Room creation form component
 */
import React, { useState, useCallback } from "react";

interface RoomCreateProps {
  onCreateRoom: (roomName: string, userName: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export const RoomCreate: React.FC<RoomCreateProps> = ({
  onCreateRoom,
  onBack,
  isLoading = false,
}) => {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const [errors, setErrors] = useState<{
    roomName?: string;
    userName?: string;
  }>({});

  const validateForm = useCallback(() => {
    const newErrors: typeof errors = {};

    if (!roomName.trim()) {
      newErrors.roomName = "Room name is required";
    } else if (roomName.trim().length < 3) {
      newErrors.roomName = "Room name must be at least 3 characters";
    } else if (roomName.trim().length > 50) {
      newErrors.roomName = "Room name must be less than 50 characters";
    }

    if (!userName.trim()) {
      newErrors.userName = "Your name is required";
    } else if (userName.trim().length < 2) {
      newErrors.userName = "Name must be at least 2 characters";
    } else if (userName.trim().length > 30) {
      newErrors.userName = "Name must be less than 30 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [roomName, userName]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (validateForm()) {
        onCreateRoom(roomName.trim(), userName.trim());
      }
    },
    [validateForm, onCreateRoom, roomName, userName],
  );

  const handleRoomNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRoomName(e.target.value);
      if (errors.roomName) {
        setErrors((prev) => ({ ...prev, roomName: undefined }));
      }
    },
    [errors.roomName],
  );

  const handleUserNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserName(e.target.value);
      if (errors.userName) {
        setErrors((prev) => ({ ...prev, userName: undefined }));
      }
    },
    [errors.userName],
  );

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="text-gray-600 hover:text-gray-800 mr-3 disabled:opacity-50"
          aria-label="Go back"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">Create Room</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="mb-4">
          <label
            htmlFor="roomName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Room Name
          </label>
          <input
            type="text"
            id="roomName"
            value={roomName}
            onChange={handleRoomNameChange}
            disabled={isLoading}
            placeholder="Enter room name"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.roomName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.roomName && (
            <p className="mt-1 text-sm text-red-600">{errors.roomName}</p>
          )}
        </div>

        <div className="mb-6">
          <label
            htmlFor="userName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Your Name
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={handleUserNameChange}
            disabled={isLoading}
            placeholder="Enter your name"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.userName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.userName && (
            <p className="mt-1 text-sm text-red-600">{errors.userName}</p>
          )}
        </div>

        <div className="mt-auto">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating Room...
              </span>
            ) : (
              "Create Room"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
