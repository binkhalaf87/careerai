import { useMemo, useRef, useState } from "react";
import { Upload, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useBulkCandidateUpload } from "@/hooks/useBulkCandidateUpload";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruiterId: string;
  language: "ar" | "en";
  onCompleted?: () => void;
}

export function BulkResumeUploadDialog({ open, onOpenChange, recruiterId, language, onCompleted }: Props) {
  const ar = language === "ar";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [autoRunAnalysis, setAutoRunAnalysis] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { items, running, uploadFiles, reset } = useBulkCandidateUpload();

  const summary = useMemo(() => {
    const success = items.filter((item) => item.status === "success").length;
    const failed = items.filter((item) => item.status === "failed").length;
    return { success, failed };
  }, [items]);

  const applyFiles = (selected: FileList | File[]) => {
    const nextFiles = Array.from(selected);
    if (nextFiles.length > 10) {
      toast.error(ar ? "الحد الأقصى 10 ملفات في الدفعة" : "Maximum 10 files per batch");
      return;
    }
    const invalid = nextFiles.filter((file) => !/\.(pdf|docx)$/i.test(file.name));
    if (invalid.length) {
      toast.error(ar ? "الملفات المسموحة PDF و DOCX فقط" : "Only PDF and DOCX are supported");
      return;
    }
    setFiles(nextFiles);
  };

  const handleSubmit = async () => {
    if (!files.length) {
      toast.error(ar ? "اختر ملفات أولاً" : "Select files first");
      return;
    }
    try {
      const result = await uploadFiles({ files, recruiterId, language, autoRunAnalysis });
      toast.success(
        ar
          ? `نجح ${result.successCount} وفشل ${result.failedCount}`
          : `${result.successCount} succeeded, ${result.failedCount} failed`,
      );
      onCompleted?.();
    } catch (error: any) {
      toast.error(error?.message || (ar ? "فشل الرفع الجماعي" : "Bulk upload failed"));
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !running) {
      setFiles([]);
      setAutoRunAnalysis(false);
      reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ar ? "رفع متعدد للسير الذاتية" : "Upload Multiple CVs"}</DialogTitle>
          <DialogDescription>
            {ar ? "ارفع حتى 10 ملفات PDF أو DOCX في دفعة واحدة" : "Upload up to 10 PDF or DOCX files in one batch"}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            applyFiles(event.dataTransfer.files);
          }}
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{ar ? "اسحب الملفات هنا أو اخترها" : "Drag files here or browse"}</p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX · Max 10 files</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => inputRef.current?.click()} disabled={running}>
            {ar ? "اختيار الملفات" : "Choose Files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            className="hidden"
            onChange={(event) => applyFiles(event.target.files || [])}
            disabled={running}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="auto-analysis" checked={autoRunAnalysis} onCheckedChange={(checked) => setAutoRunAnalysis(Boolean(checked))} />
          <Label htmlFor="auto-analysis">{ar ? "تشغيل تحليل AI بعد الرفع" : "Run AI Analysis after upload"}</Label>
        </div>

        {!!files.length && !items.length && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 text-xs text-muted-foreground">{ar ? `تم اختيار ${files.length} ملف` : `${files.length} files selected`}</div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file) => (
                <div key={file.name} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!items.length && (
          <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border p-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1 truncate font-medium">{item.fileName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {item.status === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}
                    {item.status === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> : null}
                    {["uploading", "processing", "analyzing"].includes(item.status) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>{item.status}</span>
                  </div>
                </div>
                <Progress value={item.progress} />
                {item.message ? <p className="mt-2 text-xs text-muted-foreground">{item.message}</p> : null}
              </div>
            ))}
          </div>
        )}

        {!!items.length && !running && (
          <div className="text-xs text-muted-foreground">
            {ar ? `نجح ${summary.success} · فشل ${summary.failed}` : `Succeeded ${summary.success} · Failed ${summary.failed}`}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={running}>
            {ar ? "إغلاق" : "Close"}
          </Button>
          <Button onClick={handleSubmit} disabled={running || !files.length || (items.length > 0 && !running)}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {items.length > 0 && !running ? (ar ? "تم الرفع" : "Upload Complete") : (ar ? "بدء الرفع" : "Start Upload")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


