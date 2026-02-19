"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegistrationRoomOption {
  id: string;
  label: string;
}

interface RegistrationHostelOption {
  id: string;
  name: string;
  rooms: RegistrationRoomOption[];
}

interface LoginFormProps {
  registrationHostels: RegistrationHostelOption[];
}

const loginSchema = z.object({
  studentId: z.string().min(3, "Student ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z
  .object({
    studentId: z.string().min(3, "Student ID is required"),
    name: z.string().min(2, "Full name is required"),
    phone: z.string().optional(),
    hostelId: z.string().min(1, "Hostel is required"),
    roomId: z.string().min(1, "Room is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export function LoginForm({ registrationHostels }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      hostelId: "",
      roomId: "",
      phone: "",
    },
  });

  const selectedHostelId = registerForm.watch("hostelId");
  const availableRooms = useMemo(
    () => registrationHostels.find((h) => h.id === selectedHostelId)?.rooms ?? [],
    [registrationHostels, selectedHostelId]
  );

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await signIn("credentials", {
        email: data.studentId.trim(),
        password: data.password,
        redirect: false,
      });

      if (!result?.ok) {
        setError(result?.error || "Authentication failed. Please check Student ID and password.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message || "Registration failed");
        setIsLoading(false);
        return;
      }

      setSuccess(payload.message || "Registration successful");
      setMode("login");
      loginForm.setValue("studentId", data.studentId);
      registerForm.reset({
        studentId: "",
        name: "",
        phone: "",
        hostelId: "",
        roomId: "",
        password: "",
        confirmPassword: "",
      });
      setIsLoading(false);
    } catch {
      setError("An error occurred while registering. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === "login" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setSuccess(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === "register" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Register
          </button>
        </div>
        <CardTitle className="text-2xl">
          {mode === "login" ? "Student Login" : "Student Registration"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Sign in to access ORCS"
            : "Create your student account aligned with hostel room assignment"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                type="text"
                placeholder="e.g. S12345 or student@domain.com"
                disabled={isLoading}
                className="h-12 text-base"
                {...loginForm.register("studentId")}
              />
              {loginForm.formState.errors.studentId && (
                <p className="text-sm text-red-600">
                  {loginForm.formState.errors.studentId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                disabled={isLoading}
                className="h-12 text-base"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button type="submit" className="h-12 w-full text-base" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Forgot Password?
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Help
                </Link>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registerStudentId">Student ID</Label>
              <Input
                id="registerStudentId"
                type="text"
                placeholder="e.g. S12345"
                className="h-11"
                disabled={isLoading}
                {...registerForm.register("studentId")}
              />
              {registerForm.formState.errors.studentId && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.studentId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registerName">Full Name</Label>
              <Input
                id="registerName"
                type="text"
                className="h-11"
                disabled={isLoading}
                {...registerForm.register("name")}
              />
              {registerForm.formState.errors.name && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registerPhone">Phone (Optional)</Label>
              <Input
                id="registerPhone"
                type="text"
                className="h-11"
                disabled={isLoading}
                {...registerForm.register("phone")}
              />
            </div>

            <div className="space-y-2">
              <Label>Hostel</Label>
              <Select
                value={selectedHostelId}
                onValueChange={(value) => {
                  registerForm.setValue("hostelId", value, { shouldValidate: true });
                  registerForm.setValue("roomId", "", { shouldValidate: true });
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  {registrationHostels.map((hostel) => (
                    <SelectItem key={hostel.id} value={hostel.id}>
                      {hostel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registerForm.formState.errors.hostelId && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.hostelId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={registerForm.watch("roomId")}
                onValueChange={(value) =>
                  registerForm.setValue("roomId", value, { shouldValidate: true })
                }
                disabled={!selectedHostelId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {registerForm.formState.errors.roomId && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.roomId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registerPassword">Password</Label>
              <Input
                id="registerPassword"
                type="password"
                className="h-11"
                disabled={isLoading}
                {...registerForm.register("password")}
              />
              {registerForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registerConfirmPassword">Confirm Password</Label>
              <Input
                id="registerConfirmPassword"
                type="password"
                className="h-11"
                disabled={isLoading}
                {...registerForm.register("confirmPassword")}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">
                  {registerForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

