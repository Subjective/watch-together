import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Settings, User, Crown, Eye, RotateCcw } from "lucide-react";
import { StorageManager } from "../background/storage";
import type { UserPreferences } from "../background/storage";
import { useConditionalToast } from "@/hooks/use-conditional-toast";

interface SettingsPageProps {
  onNavigateToHome: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onNavigateToHome,
}) => {
  const [settings, setSettings] = useState<UserPreferences>({
    followMode: "AUTO_FOLLOW",
    autoJoinRooms: true,
    notificationsEnabled: true,
    defaultUserName: "",
    defaultRoomName: "My Room",
    backgroundSyncEnabled: true,
    defaultControlMode: "HOST_ONLY",
    preferEnhancedUrl: true,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const conditionalToast = useConditionalToast();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await StorageManager.getUserPreferences();
        setSettings(loadedSettings);
      } catch (error) {
        console.error("Failed to load settings:", error);
        await conditionalToast(
          {
            title: "Failed to load settings",
            description: "Using default values",
            variant: "destructive",
          },
          { forceShow: true },
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [conditionalToast]);

  const handleSettingChange = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate default user name
      const trimmedUserName = settings.defaultUserName.trim();
      if (trimmedUserName.length > 20) {
        await conditionalToast(
          {
            title: "Invalid user name",
            description: "Default user name must be 1-20 characters",
            variant: "destructive",
          },
          { forceShow: true },
        );
        setIsSaving(false);
        return;
      }

      // Validate default room name
      const trimmedRoomName = settings.defaultRoomName.trim();
      if (!trimmedRoomName) {
        await conditionalToast(
          {
            title: "Invalid room name",
            description: "Default room name cannot be empty",
            variant: "destructive",
          },
          { forceShow: true },
        );
        setIsSaving(false);
        return;
      }

      if (trimmedRoomName.length > 30) {
        await conditionalToast(
          {
            title: "Invalid room name",
            description: "Default room name must be 1-30 characters",
            variant: "destructive",
          },
          { forceShow: true },
        );
        setIsSaving(false);
        return;
      }

      await StorageManager.setUserPreferences(settings);
      setHasChanges(false);
      await conditionalToast({
        title: "Settings saved!",
        description: "Your preferences have been updated.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      await conditionalToast(
        {
          title: "Failed to save settings",
          description: "Please try again",
          variant: "destructive",
        },
        { forceShow: true },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      // Get default settings and update our state
      const defaultSettings = await StorageManager.getDefaultUserPreferences();
      setSettings(defaultSettings);
      setHasChanges(true);
      await conditionalToast({
        title: "Settings reset",
        description: "All settings have been restored to defaults.",
      });
    } catch (error) {
      console.error("Failed to reset settings:", error);
      await conditionalToast(
        {
          title: "Failed to reset settings",
          description: "Please try again",
          variant: "destructive",
        },
        { forceShow: true },
      );
    }
  };

  if (isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-spin" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
            onClick={onNavigateToHome}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-xl">Settings</h1>
        </div>
        <div className="flex items-center gap-2 h-8">
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl h-7 text-xs px-3"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Customize your display name and default room settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultName">Default Name</Label>
                <Input
                  id="defaultName"
                  value={settings.defaultUserName}
                  onChange={(e) =>
                    handleSettingChange("defaultUserName", e.target.value)
                  }
                  placeholder="Enter your display name"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  This name will be used when joining rooms
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultRoomName">Default Room Name</Label>
                <Input
                  id="defaultRoomName"
                  value={settings.defaultRoomName}
                  onChange={(e) =>
                    handleSettingChange("defaultRoomName", e.target.value)
                  }
                  placeholder="Enter default room name"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  This name will be used when creating new rooms
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Host Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="w-5 h-5" />
                Host Settings
              </CardTitle>
              <CardDescription>
                Configure default behavior when hosting rooms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Default Control Mode</Label>
                <RadioGroup
                  value={settings.defaultControlMode}
                  onValueChange={(value: "HOST_ONLY" | "FREE_FOR_ALL") =>
                    handleSettingChange("defaultControlMode", value)
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="FREE_FOR_ALL" id="free-for-all" />
                    <div className="flex-1">
                      <Label
                        htmlFor="free-for-all"
                        className="font-medium cursor-pointer"
                      >
                        Free for All
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        All participants can control playback
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                    <RadioGroupItem value="HOST_ONLY" id="host-only" />
                    <div className="flex-1">
                      <Label
                        htmlFor="host-only"
                        className="font-medium cursor-pointer"
                      >
                        Host Only
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only the host can control playback
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Participant Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="w-5 h-5" />
                Participant Settings
              </CardTitle>
              <CardDescription>
                Configure behavior when joining rooms as a participant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label htmlFor="autoFollow" className="font-medium">
                    Auto-follow Host
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically follow the host to new videos
                  </p>
                </div>
                <Switch
                  id="autoFollow"
                  checked={settings.followMode === "AUTO_FOLLOW"}
                  onCheckedChange={(checked) =>
                    handleSettingChange(
                      "followMode",
                      checked ? "AUTO_FOLLOW" : "MANUAL_FOLLOW",
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5" />
                General
              </CardTitle>
              <CardDescription>
                General app preferences and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label htmlFor="notifications" className="font-medium">
                    Show Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Display toast notifications for actions
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("notificationsEnabled", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label htmlFor="autoJoin" className="font-medium">
                    Auto-join with Links
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically join rooms when clicking shared links
                  </p>
                </div>
                <Switch
                  id="autoJoin"
                  checked={settings.autoJoinRooms}
                  onCheckedChange={(checked) =>
                    handleSettingChange("autoJoinRooms", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label htmlFor="backgroundSync" className="font-medium">
                    Background Sync
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keep video synchronized in the background
                  </p>
                </div>
                <Switch
                  id="backgroundSync"
                  checked={settings.backgroundSyncEnabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("backgroundSyncEnabled", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label htmlFor="enhancedUrl" className="font-medium">
                    Enhanced URLs
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Copy enhanced share links when possible, otherwise copy room
                    code
                  </p>
                </div>
                <Switch
                  id="enhancedUrl"
                  checked={settings.preferEnhancedUrl}
                  onCheckedChange={(checked) =>
                    handleSettingChange("preferEnhancedUrl", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Reset Section */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <RotateCcw className="w-5 h-5" />
                Reset Settings
              </CardTitle>
              <CardDescription>
                Restore all settings to their default values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 bg-transparent"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
