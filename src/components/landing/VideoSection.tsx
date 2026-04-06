import { motion } from "framer-motion";
import { Play, Monitor } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const VideoSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <section id="demo" className="py-24 md:py-32 relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card to-background" />

      <div className="container relative max-w-5xl">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-display font-medium mb-5">
            <Monitor size={14} />
            {ar ? "عرض مباشر" : "Live Demo"}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>شاهد كيف يعمل <span className="text-primary">TALENTRY</span></>
            ) : (
              <>See <span className="text-primary">TALENTRY</span> in Action</>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-xl mx-auto text-lg leading-relaxed">
            {ar
              ? "من رفع السيرة الذاتية إلى التقديم على الوظائف — كل شيء يحدث في أقل من دقيقتين."
              : "From uploading your resume to applying for jobs — everything happens in under 2 minutes."}
          </p>
        </motion.div>

        <motion.div
          className="relative group cursor-pointer"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative aspect-video rounded-2xl bg-card border border-border shadow-prominent overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5" />

            {/* Mockup content */}
            <div className="absolute inset-8 md:inset-10 flex gap-4">
              {/* Sidebar */}
              <div className="hidden sm:flex flex-col gap-3 w-1/4">
                <div className="h-8 w-3/4 rounded-lg bg-primary/10" />
                <div className="flex-1 space-y-2.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-6 rounded-md ${i === 1 ? "bg-primary/15" : "bg-border/30"}`} />
                  ))}
                </div>
              </div>
              {/* Main */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1 h-20 rounded-xl bg-border/25 p-3">
                    <div className="h-2 w-1/3 bg-border/40 rounded mb-2" />
                    <div className="h-8 w-1/2 bg-primary/10 rounded-lg" />
                  </div>
                  <div className="flex-1 h-20 rounded-xl bg-border/25 p-3">
                    <div className="h-2 w-1/3 bg-border/40 rounded mb-2" />
                    <div className="h-8 w-2/3 bg-emerald-500/10 rounded-lg" />
                  </div>
                </div>
                <div className="flex-1 rounded-xl bg-border/15 p-3">
                  <div className="h-2 w-1/4 bg-border/40 rounded mb-3" />
                  <div className="grid grid-cols-3 gap-2 h-3/4">
                    <div className="rounded-lg bg-border/20" />
                    <div className="rounded-lg bg-border/15" />
                    <div className="rounded-lg bg-border/20" />
                  </div>
                </div>
              </div>
            </div>

            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/3 group-hover:bg-foreground/8 transition-colors duration-500">
              <motion.div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Play size={32} className={`${ar ? "mr-1" : "ml-1"}`} />
              </motion.div>
            </div>

            {/* Badge */}
            <div className={`absolute bottom-5 ${ar ? "right-5" : "left-5"} flex items-center gap-2 px-4 py-2 rounded-full bg-card/90 backdrop-blur-sm border border-border text-xs font-display font-medium text-muted-foreground`}>
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              {ar ? "عرض المنتج • ٤٥ ثانية" : "Product Demo • 45s"}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default VideoSection;
