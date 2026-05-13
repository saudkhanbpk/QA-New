"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, TestTube, CheckCircle2, XCircle, Search, Calendar, Globe, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  created_at: string;
  banned?: boolean;
}

interface TestRun {
  id: string;
  user_id: string;
  page_url: string;
  status: string;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
  profiles?: { email: string };
}

interface AdminDashboardProps {
  profiles: Profile[];
  testRuns: TestRun[];
  stats: {
    totalUsers: number;
    totalTests: number;
    completedTests: number;
    failedTests: number;
  };
}

export function AdminDashboard({ profiles, testRuns, stats }: AdminDashboardProps) {
  const [searchUser, setSearchUser] = useState("");
  const [searchTest, setSearchTest] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; banned: boolean } | null>(null);
  
  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [testPage, setTestPage] = useState(1);
  const usersPerPage = 10;
  const testsPerPage = 20;

  // Real-time data states
  const [liveProfiles, setLiveProfiles] = useState(profiles);
  const [liveTestRuns, setLiveTestRuns] = useState(testRuns);
  const [liveStats, setLiveStats] = useState(stats);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/admin/live-data');
        if (response.ok) {
          const data = await response.json();
          setLiveProfiles(data.profiles);
          setLiveTestRuns(data.testRuns);
          setLiveStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch live data:', error);
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const filteredProfiles = liveProfiles.filter(p =>
    p.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredTests = liveTestRuns.filter(t =>
    t.page_url.toLowerCase().includes(searchTest.toLowerCase()) ||
    (t.profiles?.email || "").toLowerCase().includes(searchTest.toLowerCase())
  );

  // Pagination calculations
  const totalUserPages = Math.ceil(filteredProfiles.length / usersPerPage);
  const totalTestPages = Math.ceil(filteredTests.length / testsPerPage);
  
  const paginatedUsers = filteredProfiles.slice(
    (userPage - 1) * usersPerPage,
    userPage * usersPerPage
  );
  
  const paginatedTests = filteredTests.slice(
    (testPage - 1) * testsPerPage,
    testPage * testsPerPage
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setUserPage(1);
  }, [searchUser]);

  useEffect(() => {
    setTestPage(1);
  }, [searchTest]);

  function openBanModal(userId: string, email: string, currentlyBanned: boolean) {
    setSelectedUser({ id: userId, email, banned: currentlyBanned });
    setBanModalOpen(true);
  }

  function openDeleteModal(userId: string, email: string) {
    setSelectedUser({ id: userId, email, banned: false });
    setDeleteModalOpen(true);
  }

  async function handleConfirmBanToggle() {
    if (!selectedUser) return;

    setLoading(selectedUser.id);
    setBanModalOpen(false);

    try {
      const response = await fetch(`/api/admin/user/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !selectedUser.banned }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Error: ${data.error}`);
        return;
      }

      window.location.reload();
    } catch (error) {
      alert(`Failed to ${selectedUser.banned ? "unban" : "ban"} user`);
    } finally {
      setLoading(null);
      setSelectedUser(null);
    }
  }

  async function handleConfirmDelete() {
    if (!selectedUser) return;

    setLoading(selectedUser.id);
    setDeleteModalOpen(false);

    try {
      const response = await fetch(`/api/admin/user/${selectedUser.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Error: ${data.error}`);
        return;
      }

      window.location.reload();
    } catch (error) {
      alert("Failed to delete user");
    } finally {
      setLoading(null);
      setSelectedUser(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage all users and view system-wide analytics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveStats.totalTests}</div>
            <p className="text-xs text-muted-foreground">All test runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{liveStats.completedTests}</div>
            <p className="text-xs text-muted-foreground">
              {liveStats.totalTests > 0 ? Math.round((liveStats.completedTests / liveStats.totalTests) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{liveStats.failedTests}</div>
            <p className="text-xs text-muted-foreground">
              {liveStats.totalTests > 0 ? Math.round((liveStats.failedTests / liveStats.totalTests) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">All Users ({filteredProfiles.length})</TabsTrigger>
          <TabsTrigger value="tests">All Tests ({filteredTests.length})</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {paginatedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                ) : (
                  paginatedUsers.map((profile) => {
                    const userTests = liveTestRuns.filter(t => t.user_id === profile.id);
                    const completedCount = userTests.filter(t => t.status === "completed").length;
                    const isBanned = profile.banned || false;
                    const isLoading = loading === profile.id;
                    
                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{profile.email}</p>
                            <Badge variant="outline" className="text-xs">
                              {userTests.length} test{userTests.length !== 1 ? 's' : ''}
                            </Badge>
                            {isBanned && (
                              <Badge variant="destructive" className="text-xs">
                                Banned
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Joined {new Date(profile.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-green-600">
                              {completedCount} completed
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {isBanned ? "Banned" : "Active"}
                            </span>
                            <Switch
                              checked={!isBanned}
                              onCheckedChange={() => openBanModal(profile.id, profile.email, isBanned)}
                              disabled={isLoading}
                            />
                          </div>
                          <Link
                            href={`/admin/user/${profile.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            View Details →
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteModal(profile.id, profile.email)}
                            disabled={isLoading}
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* User Pagination */}
              {totalUserPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((userPage - 1) * usersPerPage) + 1} to {Math.min(userPage * usersPerPage, filteredProfiles.length)} of {filteredProfiles.length} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {userPage} of {totalUserPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                      disabled={userPage === totalUserPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tests by URL or user email..."
              value={searchTest}
              onChange={(e) => setSearchTest(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Test Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {paginatedTests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tests found</p>
                ) : (
                  paginatedTests.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium text-sm truncate max-w-md">{test.page_url}</p>
                          <Badge
                            variant={
                              test.status === "completed" ? "default" :
                              test.status === "failed" ? "destructive" :
                              test.status === "running" ? "secondary" : "outline"
                            }
                          >
                            {test.status}
                          </Badge>
                          {test.overall_score !== null && (
                            <Badge variant="outline" className={
                              test.overall_score >= 90 ? "text-green-600" :
                              test.overall_score >= 70 ? "text-yellow-600" : "text-red-600"
                            }>
                              Score: {test.overall_score}/100
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>User: {test.profiles?.email || "Unknown"}</span>
                          <span>{new Date(test.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <Link
                        href={`/test/${test.id}`}
                        className="text-sm text-primary hover:underline whitespace-nowrap"
                      >
                        View Report →
                      </Link>
                    </div>
                  ))
                )}
              </div>
              
              {/* Test Pagination */}
              {totalTestPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((testPage - 1) * testsPerPage) + 1} to {Math.min(testPage * testsPerPage, filteredTests.length)} of {filteredTests.length} tests
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestPage(p => Math.max(1, p - 1))}
                      disabled={testPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {testPage} of {totalTestPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestPage(p => Math.min(totalTestPages, p + 1))}
                      disabled={testPage === totalTestPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ban/Unban Confirmation Modal */}
      <Dialog open={banModalOpen} onOpenChange={setBanModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {selectedUser?.banned ? "Unban User" : "Ban User"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.banned ? (
                <>
                  Are you sure you want to <strong>unban</strong> user <strong>{selectedUser?.email}</strong>?
                  <br />
                  <br />
                  They will be able to login and use the system again.
                </>
              ) : (
                <>
                  Are you sure you want to <strong>ban</strong> user <strong>{selectedUser?.email}</strong>?
                  <br />
                  <br />
                  They will not be able to login until you unban them.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.banned ? "default" : "destructive"}
              onClick={handleConfirmBanToggle}
            >
              {selectedUser?.banned ? "Unban User" : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to <strong>permanently delete</strong> user <strong>{selectedUser?.email}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Delete the user account</li>
                <li>Delete all their test runs</li>
                <li>Delete all associated data</li>
              </ul>
              <br />
              <strong className="text-red-600">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
