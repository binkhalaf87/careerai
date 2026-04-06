import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import PricingSection from "@/components/landing/PricingSection";
import PricingComparisonTable from "@/components/landing/PricingComparisonTable";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <PricingSection />
        <PricingComparisonTable />
      </div>
      <Footer />
    </div>
  );
};

export default Pricing;
