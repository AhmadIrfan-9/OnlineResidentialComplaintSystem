"use client";

import { useState } from "react";
import { CheckCircle, Phone, Upload, Loader2, Check } from "lucide-react";
import { updateStudentProfile } from "@/app/profile/actions";

export default function ProfileForm({ initialData }: { initialData: any }) {
  const roomParts = initialData.roomNumberStr ? initialData.roomNumberStr.split("-") : [];
  
  const [formData, setFormData] = useState({
    studentId: initialData.studentId || "",
    name: initialData.name || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    hostelId: initialData.hostelId || "",
    block: roomParts[0] || "",
    floor: roomParts[1] || "",
    roomNo: roomParts[2] || "",
    academicProgram: initialData.academicProgram || ""
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorToast, setErrorToast] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const isStudentIdValid = /^[A-Z]{2}\d{7,8}$/.test(formData.studentId);
  
  const isValid = (field: string) => {
    if (!attemptedSubmit) return null;
    if (field === "studentId") return isStudentIdValid;
    return !!(formData as any)[field];
  };

  const getBorderColor = (field: string) => {
    const valid = isValid(field);
    if (valid === null) return "border-slate-200 focus:border-blue-500 focus:ring-blue-500";
    return valid ? "border-green-500 ring-1 ring-green-500" : "border-red-400 ring-1 ring-red-400";
  };

  const handleChange = (e: any) => {
    setSaved(false);
    setErrorToast("");
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setAttemptedSubmit(true);
    
    const missing = [];
    if (!isStudentIdValid) missing.push("Student ID correctly");
    if (!formData.name) missing.push("Full Name");
    if (!formData.phone) missing.push("Contact Number");
    if (!formData.hostelId) missing.push("Hostel");
    if (!formData.block) missing.push("Block");
    if (!formData.floor) missing.push("Floor");
    if (!formData.roomNo) missing.push("Room Number");
    if (!formData.academicProgram) missing.push("Academic Program");

    if (missing.length > 0) {
      setErrorToast(`Your profile is not completed because you leave ${missing[0]} empty.`);
      return;
    }

    setSaving(true);
    setErrorToast("");

    const res = await updateStudentProfile(formData);
    if (res.success) {
      setSaved(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } else {
      setErrorToast(res.error || "Failed to update profile.");
    }
    setSaving(false);
  };

  const initialLetter = formData.name ? formData.name.charAt(0).toUpperCase() : "U";

  // Helper arrays for dropdowns
  const blocks = ["C1", "C2", "C3"];
  const floors = Array.from({ length: 10 }, (_, i) => (i + 1).toString().padStart(2, "0"));
  const rooms = Array.from({ length: 8 }, (_, i) => (i + 1).toString().padStart(2, "0"));

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10 font-sans">
      <div className="mb-8 border-b border-slate-100 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profile</h1>
      </div>

      <div className="grid gap-10 md:grid-cols-[200px_1fr]">
        
        {/* Left Column: Avatar */}
        <div className="flex flex-col items-center top-6 space-y-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-100 text-5xl font-bold text-slate-400 shadow-inner">
            {initialLetter}
          </div>
          <button className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
            <Upload className="h-4 w-4" /> Upload Photo
          </button>
        </div>

        {/* Right Column: Form Fields */}
        <div className="space-y-8">
          
          {/* Section 1: Basic Information */}
          <section className="space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Basic Information</h2>
            
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1 relative">
                <label className="text-sm font-medium text-slate-700">UNITEN Student ID</label>
                <div className="relative">
                  <input
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleChange}
                    placeholder="e.g. SW0108XXX"
                    className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("studentId")}`}
                  />
                  {formData.studentId.length > 0 && (
                    <CheckCircle className={`absolute right-3 top-2.5 h-5 w-5 ${isStudentIdValid ? "text-green-500" : "text-slate-300"}`} />
                  )}
                </div>
                {isValid("studentId") === false && <p className="text-xs text-red-500">Must be valid format (e.g. SW0108XXX)</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Full Name (as per UNITEN record)</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("name")}`}
                />
                {isValid("name") === false && <p className="text-xs text-red-500">This field is required</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">UNITEN Student Email</label>
                <input
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full rounded-md border bg-white pl-9 pr-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("phone")}`}
                  />
                </div>
                {isValid("phone") === false && <p className="text-xs text-red-500">This field is required</p>}
              </div>
            </div>
          </section>

          {/* Section 2: Hostel & Accommodation */}
          <section className="space-y-6 pt-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Hostel & Accommodation</h2>
            
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Hostel</label>
                <select
                  name="hostelId"
                  value={formData.hostelId}
                  onChange={handleChange}
                  className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("hostelId")}`}
                >
                  <option value="">Select Hostel</option>
                  <option value={initialData.hostelId || "cendikiawan"}>Cendikiawan</option>
                  <option value="ilmu">Ilmu</option>
                  <option value="murni">Murni</option>
                  <option value="amanah">Amanah</option>
                </select>
                {isValid("hostelId") === false && <p className="text-xs text-red-500">This field is required</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Academic Program</label>
                <input
                  name="academicProgram"
                  value={formData.academicProgram}
                  onChange={handleChange}
                  placeholder="e.g. Bachelor of Computer Science"
                  className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("academicProgram")}`}
                />
                {isValid("academicProgram") === false && <p className="text-xs text-red-500">This field is required</p>}
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 mb-1 block">Room Number Format: [Block]-[Floor]-[Room]</label>
                <div className="flex items-center gap-2 sm:gap-4 max-w-lg">
                  <div className="flex-1">
                    <select
                      name="block"
                      value={formData.block}
                      onChange={handleChange}
                      className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("block")}`}
                    >
                      <option value="">Block</option>
                      {blocks.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <span className="text-slate-400 font-bold">-</span>
                  <div className="flex-1">
                    <select
                      name="floor"
                      value={formData.floor}
                      onChange={handleChange}
                      className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("floor")}`}
                    >
                      <option value="">Floor</option>
                      {floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <span className="text-slate-400 font-bold">-</span>
                  <div className="flex-1">
                    <select
                      name="roomNo"
                      value={formData.roomNo}
                      onChange={handleChange}
                      className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm transition-all focus:outline-none ${getBorderColor("roomNo")}`}
                    >
                      <option value="">Room</option>
                      {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {(isValid("block") === false || isValid("floor") === false || isValid("roomNo") === false) && (
                  <p className="text-xs text-red-500 mt-1">Please completely fill out block, floor, and room number</p>
                )}
              </div>
            </div>
          </section>

          {errorToast && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 flex items-center gap-2">
              <span className="shrink-0">⚠️</span> {errorToast}
            </div>
          )}

          <div className="flex justify-center pt-6 pb-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex min-w-[200px] items-center justify-center gap-2 rounded-lg px-6 py-3 font-bold text-white shadow-md transition-all ${
                saved 
                  ? "bg-green-600 hover:bg-green-700 shadow-green-200" 
                  : "bg-[#0b4a99] hover:bg-[#093c7d] shadow-blue-200"
              } disabled:opacity-70`}
            >
              {saving ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
              ) : saved ? (
                <><CheckCircle className="h-5 w-5" /> Profile Saved!</>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex animate-in slide-in-from-bottom-5 items-center gap-3 rounded-lg border border-green-200 bg-white p-4 shadow-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Success</p>
            <p className="text-sm text-slate-600">Profile Successfully Updated</p>
          </div>
        </div>
      )}
    </div>
  );
}
