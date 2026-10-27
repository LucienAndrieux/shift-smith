"use client";

import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { approveUser, rejectUser, setUserRole } from "./actions";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
  accessStatus: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

const STATUSES = ["pending", "approved", "rejected"] as const;

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const { pending, run } = useAction();
  const pendingCount = users.filter((u) => u.accessStatus === "pending").length;

  return (
    <Tabs defaultValue={pendingCount > 0 ? "pending" : "approved"}>
      <TabsList>
        {STATUSES.map((status) => (
          <TabsTrigger key={status} value={status} className="capitalize">
            {status}
            <Badge variant="secondary" className="ml-1">
              {users.filter((u) => u.accessStatus === status).length}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {STATUSES.map((status) => {
        const rows = users.filter((u) => u.accessStatus === status);
        return (
          <TabsContent key={status} value={status}>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No {status} users.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((u) => {
                    const isMe = u.id === currentUserId;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.name}
                          {isMe && (
                            <span className="ml-1 text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.createdAt}
                          {u.approvedBy && (
                            <div className="text-xs">
                              {status === "approved" ? "Approved" : "Reviewed"}{" "}
                              by {u.approvedBy}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            disabled={pending || isMe}
                            onValueChange={(role) =>
                              run(
                                () =>
                                  setUserRole({
                                    userId: u.id,
                                    role: role as UserRow["role"],
                                  }),
                                { success: "Role updated" },
                              )
                            }
                          >
                            <SelectTrigger size="sm" className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {u.accessStatus !== "approved" && (
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                run(() => approveUser({ userId: u.id }), {
                                  success: `${u.name} approved`,
                                })
                              }
                            >
                              <Check /> Approve
                            </Button>
                          )}
                          {u.accessStatus !== "rejected" && !isMe && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() =>
                                run(() => rejectUser({ userId: u.id }), {
                                  success: `${u.name} rejected`,
                                })
                              }
                            >
                              <X />{" "}
                              {u.accessStatus === "approved"
                                ? "Revoke"
                                : "Reject"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
