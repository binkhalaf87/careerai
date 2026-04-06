import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Briefcase, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BulletEditor from "./BulletEditor";
import type { ExperienceRole } from "@/lib/resume-utils";

interface ExperienceEditorProps {
  roles: ExperienceRole[];
  onChange: (roles: ExperienceRole[]) => void;
  isRTL: boolean;
  language: string;
}

const ExperienceEditor = ({ roles, onChange, isRTL, language }: ExperienceEditorProps) => {
  const [improvingRole, setImprovingRole] = useState<string | null>(null);

  const updateRole = (roleId: string, updates: Partial<ExperienceRole>) => {
    onChange(roles.map(r => r.id === roleId ? { ...r, ...updates } : r));
  };

  const updateBullet = (roleId: string, bulletId: string, text: string) => {
    onChange(roles.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, bullets: r.bullets.map(b => b.id === bulletId ? { ...b, text } : b) };
    }));
  };

  const deleteBullet = (roleId: string, bulletId: string) => {
    onChange(roles.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, bullets: r.bullets.filter(b => b.id !== bulletId) };
    }));
  };

  const addBullet = (roleId: string) => {
    onChange(roles.map(r => {
      if (r.id !== roleId) return r;
      const newId = `role-${roleId}-bullet-${Date.now()}`;
      return { ...r, bullets: [...r.bullets, { id: newId, text: "" }] };
    }));
  };

  const addRole = () => {
    const newRole: ExperienceRole = {
      id: `role-${Date.now()}`,
      header: "",
      bullets: [{ id: `role-${Date.now()}-bullet-0`, text: "" }],
    };
    onChange([...roles, newRole]);
  };

  const deleteRole = (roleId: string) => {
    onChange(roles.filter(r => r.id !== roleId));
  };

  const handleBulletAiAction = useCallback(async (roleId: string, bulletId: string, action: string) => {
    const role = roles.find(r => r.id === roleId);
    const bullet = role?.bullets.find(b => b.id === bulletId);
    if (!bullet?.text.trim()) return;

    try {
      const { data, error } = await supabase.functions.invoke("improve-section", {
        body: { bulletText: bullet.text, bulletAction: action, language },
      });

      if (error) throw error;
      if (data?.improved_bullet) {
        updateBullet(roleId, bulletId, data.improved_bullet);
        toast.success(isRTL ? "تم تحسين النقطة ✨" : "Bullet improved ✨");
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? "فشل التحسين" : "Improvement failed"));
    }
  }, [roles, language, isRTL]);

  const handleImproveAllBullets = useCallback(async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || role.bullets.length === 0) return;
    
    setImprovingRole(roleId);
    let improved = 0;

    for (const bullet of role.bullets) {
      if (!bullet.text.trim()) continue;
      try {
        const { data, error } = await supabase.functions.invoke("improve-section", {
          body: { bulletText: bullet.text, bulletAction: "improve", language },
        });
        if (!error && data?.improved_bullet) {
          updateBullet(roleId, bullet.id, data.improved_bullet);
          improved++;
        }
      } catch {
        // keep original on failure
      }
    }

    setImprovingRole(null);
    if (improved > 0) {
      toast.success(isRTL ? `تم تحسين ${improved} نقطة ✨` : `${improved} bullets improved ✨`);
    }
  }, [roles, language, isRTL]);

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div
          key={role.id}
          className="rounded-2xl border border-border bg-background/50 p-4 space-y-3"
        >
          {/* Role Header */}
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-primary shrink-0" />
            <Input
              value={role.header}
              onChange={(e) => updateRole(role.id, { header: e.target.value })}
              className={cn(
                "border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 font-semibold text-sm",
                isRTL && "text-right"
              )}
              dir={isRTL ? "rtl" : "ltr"}
              placeholder={isRTL ? "الشركة — المسمى الوظيفي | الفترة" : "Company — Job Title | Duration"}
            />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs shrink-0"
              disabled={improvingRole === role.id}
              onClick={() => handleImproveAllBullets(role.id)}
            >
              {improvingRole === role.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {isRTL ? "تحسين الكل" : "Improve All"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive shrink-0"
              onClick={() => deleteRole(role.id)}
            >
              {isRTL ? "حذف" : "Remove"}
            </Button>
          </div>

          {/* Bullets */}
          <div className="space-y-0.5 pl-1">
            {role.bullets.map((bullet) => (
              <BulletEditor
                key={bullet.id}
                bulletId={bullet.id}
                text={bullet.text}
                onChange={(text) => updateBullet(role.id, bullet.id, text)}
                onDelete={() => deleteBullet(role.id, bullet.id)}
                onAiAction={(action) => handleBulletAiAction(role.id, bullet.id, action)}
                isRTL={isRTL}
                language={language}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => addBullet(role.id)}
          >
            <Plus size={12} />
            {isRTL ? "أضف نقطة" : "Add Bullet"}
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="gap-2 w-full"
        onClick={addRole}
      >
        <Plus size={14} />
        {isRTL ? "أضف وظيفة جديدة" : "Add New Role"}
      </Button>
    </div>
  );
};

export default ExperienceEditor;
