import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";

function Settings() {
  const { user } = useApp();
  const { theme, toggleTheme } = useTheme();

  return (
    <Layout title="Settings">
      <div className="max-w-2xl">
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {user.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">Change Avatar</Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input defaultValue="Alex" className="mt-1" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input defaultValue="Morgan" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input defaultValue={user.email} className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input defaultValue="+1 (555) 123-4567" className="mt-1" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Account Role</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  </div>
                  <Badge variant="success" className="capitalize">{user.kycStatus}</Badge>
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "New Deal Alerts", description: "Get notified when deals matching your criteria are posted", defaultChecked: true },
                  { label: "Closing Reminders", description: "Reminders when deals are closing within 48 hours", defaultChecked: true },
                  { label: "Portfolio Updates", description: "Weekly summary of portfolio performance", defaultChecked: true },
                  { label: "Club Activity", description: "Messages and activity from your investment clubs", defaultChecked: false },
                  { label: "Distribution Notices", description: "When investment returns are distributed to your wallet", defaultChecked: true },
                  { label: "Marketing Emails", description: "Platform news, feature updates, and insights", defaultChecked: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch defaultChecked={item.defaultChecked} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Current Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <Button>Update Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">Use an authenticator app for 2FA</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button variant="outline" size="sm">View Backup Codes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" size="sm">Delete Account</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Display Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Toggle between light and dark theme</p>
                  </div>
                  <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Currency Display</p>
                    <p className="text-xs text-muted-foreground">Show amounts in USD</p>
                  </div>
                  <Badge variant="secondary">USD</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Compact Numbers</p>
                    <p className="text-xs text-muted-foreground">Show $1.2M instead of $1,200,000</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

export default Settings;
