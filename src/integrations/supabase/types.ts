export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          created_at: string
          full_analysis: Json | null
          id: string
          language: string | null
          overall_score: number
          resume_id: string
          section_scores: Json
          strengths: string[] | null
          suggestions: string[] | null
          user_id: string
          weaknesses: string[] | null
        }
        Insert: {
          created_at?: string
          full_analysis?: Json | null
          id?: string
          language?: string | null
          overall_score?: number
          resume_id: string
          section_scores?: Json
          strengths?: string[] | null
          suggestions?: string[] | null
          user_id: string
          weaknesses?: string[] | null
        }
        Update: {
          created_at?: string
          full_analysis?: Json | null
          id?: string
          language?: string | null
          overall_score?: number
          resume_id?: string
          section_scores?: Json
          strengths?: string[] | null
          suggestions?: string[] | null
          user_id?: string
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_analyses: {
        Row: {
          analysis_html: string | null
          analysis_json: Json | null
          analysis_type: string | null
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          resume_id: string | null
          score: number | null
        }
        Insert: {
          analysis_html?: string | null
          analysis_json?: Json | null
          analysis_type?: string | null
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          resume_id?: string | null
          score?: number | null
        }
        Update: {
          analysis_html?: string | null
          analysis_json?: Json | null
          analysis_type?: string | null
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resume_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_analyses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      enhancement_sessions: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          improved_data: Json | null
          language: string | null
          original_data: Json | null
          raw_text: string | null
          status: string
          structured_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          improved_data?: Json | null
          language?: string | null
          original_data?: Json | null
          raw_text?: string | null
          status?: string
          structured_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          improved_data?: Json | null
          language?: string | null
          original_data?: Json | null
          raw_text?: string | null
          status?: string
          structured_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_resumes: {
        Row: {
          ats_score: number | null
          content: Json
          created_at: string
          id: string
          language: string | null
          source_resume_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ats_score?: number | null
          content?: Json
          created_at?: string
          id?: string
          language?: string | null
          source_resume_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ats_score?: number | null
          content?: Json
          created_at?: string
          id?: string
          language?: string | null
          source_resume_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_resumes_source_resume_id_fkey"
            columns: ["source_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          gmail_email: string | null
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          gmail_email?: string | null
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          gmail_email?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_session_answers: {
        Row: {
          confidence_assessment: string | null
          created_at: string
          id: string
          ideal_answer: string | null
          improvements_json: Json | null
          question_order: number
          question_text: string
          relevance_assessment: string | null
          score: number | null
          session_id: string
          strengths_json: Json | null
          transcript_text: string | null
        }
        Insert: {
          confidence_assessment?: string | null
          created_at?: string
          id?: string
          ideal_answer?: string | null
          improvements_json?: Json | null
          question_order?: number
          question_text: string
          relevance_assessment?: string | null
          score?: number | null
          session_id: string
          strengths_json?: Json | null
          transcript_text?: string | null
        }
        Update: {
          confidence_assessment?: string | null
          created_at?: string
          id?: string
          ideal_answer?: string | null
          improvements_json?: Json | null
          question_order?: number
          question_text?: string
          relevance_assessment?: string | null
          score?: number | null
          session_id?: string
          strengths_json?: Json | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_session_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          job_title: string | null
          overall_score: number | null
          resume_id: string | null
          session_title: string
          summary_json: Json | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          overall_score?: number | null
          resume_id?: string | null
          session_title?: string
          summary_json?: Json | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          overall_score?: number | null
          resume_id?: string | null
          session_title?: string
          summary_json?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_search_history: {
        Row: {
          city: string | null
          created_at: string
          filters: Json | null
          id: string
          query: string
          results_count: number | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query: string
          results_count?: number | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string
          results_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      marketing_emails: {
        Row: {
          action_type: string
          body: string
          company_name: string | null
          cover_letter: string | null
          created_at: string
          gmail_status: string | null
          id: string
          industry: string
          job_title: string
          language: string
          recipient_email: string | null
          recruiter_name: string | null
          selected_analysis_id: string | null
          selected_resume_id: string | null
          signature_block: string | null
          subject: string
          tone: string
          user_id: string
        }
        Insert: {
          action_type?: string
          body: string
          company_name?: string | null
          cover_letter?: string | null
          created_at?: string
          gmail_status?: string | null
          id?: string
          industry: string
          job_title: string
          language?: string
          recipient_email?: string | null
          recruiter_name?: string | null
          selected_analysis_id?: string | null
          selected_resume_id?: string | null
          signature_block?: string | null
          subject: string
          tone?: string
          user_id: string
        }
        Update: {
          action_type?: string
          body?: string
          company_name?: string | null
          cover_letter?: string | null
          created_at?: string
          gmail_status?: string | null
          id?: string
          industry?: string
          job_title?: string
          language?: string
          recipient_email?: string | null
          recruiter_name?: string | null
          selected_analysis_id?: string | null
          selected_resume_id?: string | null
          signature_block?: string | null
          subject?: string
          tone?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          error_message: string | null
          id: string
          package_name: string
          payment_method: string | null
          paymob_intention_id: string | null
          paymob_order_id: string | null
          paymob_transaction_id: string | null
          points: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          package_name: string
          payment_method?: string | null
          paymob_intention_id?: string | null
          paymob_order_id?: string | null
          paymob_transaction_id?: string | null
          points: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          package_name?: string
          payment_method?: string | null
          paymob_intention_id?: string | null
          paymob_order_id?: string | null
          paymob_transaction_id?: string | null
          points?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          company_name: string | null
          created_at: string
          cv_upload_count: number
          display_name: string | null
          email: string | null
          free_analysis_used: boolean
          id: string
          job_title: string | null
          language: string | null
          onboarding_completed: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          cv_upload_count?: number
          display_name?: string | null
          email?: string | null
          free_analysis_used?: boolean
          id?: string
          job_title?: string | null
          language?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          cv_upload_count?: number
          display_name?: string | null
          email?: string | null
          free_analysis_used?: boolean
          id?: string
          job_title?: string | null
          language?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recruiter_ai_interviews: {
        Row: {
          answers: Json | null
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          overall_score: number | null
          question_set_id: string | null
          recruiter_id: string
          started_at: string | null
          status: string
          summary: Json | null
          token: string
        }
        Insert: {
          answers?: Json | null
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          question_set_id?: string | null
          recruiter_id: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          token?: string
        }
        Update: {
          answers?: Json | null
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          question_set_id?: string | null
          recruiter_id?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_ai_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_ai_interviews_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "recruiter_question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_candidate_job_matches: {
        Row: {
          candidate_id: string
          created_at: string | null
          experience_score: number
          id: string
          job_id: string
          keyword_score: number
          match_reasons: Json
          match_score: number
          recruiter_id: string
          skills_score: number
          title_score: number
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          experience_score?: number
          id?: string
          job_id: string
          keyword_score?: number
          match_reasons?: Json
          match_score?: number
          recruiter_id: string
          skills_score?: number
          title_score?: number
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          experience_score?: number
          id?: string
          job_id?: string
          keyword_score?: number
          match_reasons?: Json
          match_score?: number
          recruiter_id?: string
          skills_score?: number
          title_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_candidate_job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_candidate_job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_candidate_notes: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          id: string
          recruiter_id: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          id?: string
          recruiter_id: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
          recruiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_candidates: {
        Row: {
          ai_report: Json | null
          ats_score: number | null
          created_at: string
          current_title: string | null
          email: string | null
          experience_years: number | null
          extracted_experience_years: number | null
          extracted_skills: string[] | null
          extracted_text: string | null
          file_name: string | null
          file_path: string | null
          fit_label: string | null
          fit_score: number | null
          id: string
          interview_recommendation: string | null
          interview_results: Json | null
          interview_score: number | null
          job_id: string | null
          latest_analysis_at: string | null
          latest_analysis_html: string | null
          latest_analysis_json: Json | null
          latest_analysis_score: number | null
          latest_analysis_version: string | null
          name: string
          phone: string | null
          recruiter_id: string
          stage: string
          structured_data: Json | null
          updated_at: string
        }
        Insert: {
          ai_report?: Json | null
          ats_score?: number | null
          created_at?: string
          current_title?: string | null
          email?: string | null
          experience_years?: number | null
          extracted_experience_years?: number | null
          extracted_skills?: string[] | null
          extracted_text?: string | null
          file_name?: string | null
          file_path?: string | null
          fit_label?: string | null
          fit_score?: number | null
          id?: string
          interview_recommendation?: string | null
          interview_results?: Json | null
          interview_score?: number | null
          job_id?: string | null
          latest_analysis_at?: string | null
          latest_analysis_html?: string | null
          latest_analysis_json?: Json | null
          latest_analysis_score?: number | null
          latest_analysis_version?: string | null
          name: string
          phone?: string | null
          recruiter_id: string
          stage?: string
          structured_data?: Json | null
          updated_at?: string
        }
        Update: {
          ai_report?: Json | null
          ats_score?: number | null
          created_at?: string
          current_title?: string | null
          email?: string | null
          experience_years?: number | null
          extracted_experience_years?: number | null
          extracted_skills?: string[] | null
          extracted_text?: string | null
          file_name?: string | null
          file_path?: string | null
          fit_label?: string | null
          fit_score?: number | null
          id?: string
          interview_recommendation?: string | null
          interview_results?: Json | null
          interview_score?: number | null
          job_id?: string | null
          latest_analysis_at?: string | null
          latest_analysis_html?: string | null
          latest_analysis_json?: Json | null
          latest_analysis_score?: number | null
          latest_analysis_version?: string | null
          name?: string
          phone?: string | null
          recruiter_id?: string
          stage?: string
          structured_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_interview_sessions: {
        Row: {
          answers: Json
          candidate_id: string
          completed_at: string | null
          created_at: string
          evaluation_summary: string | null
          id: string
          job_id: string | null
          mode: string
          overall_score: number | null
          questions: Json
          recommendation: string | null
          recruiter_id: string
          started_at: string | null
          status: string
          summary: Json | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          evaluation_summary?: string | null
          id?: string
          job_id?: string | null
          mode?: string
          overall_score?: number | null
          questions?: Json
          recommendation?: string | null
          recruiter_id: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          evaluation_summary?: string | null
          id?: string
          job_id?: string | null
          mode?: string
          overall_score?: number | null
          questions?: Json
          recommendation?: string | null
          recruiter_id?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_interview_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_interview_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_jobs: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          minimum_experience_years: number | null
          preferred_skills: string[] | null
          recruiter_id: string
          required_skills: string[] | null
          seniority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          minimum_experience_years?: number | null
          preferred_skills?: string[] | null
          recruiter_id: string
          required_skills?: string[] | null
          seniority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          minimum_experience_years?: number | null
          preferred_skills?: string[] | null
          recruiter_id?: string
          required_skills?: string[] | null
          seniority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recruiter_live_interviews: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          meeting_link: string | null
          notes: string | null
          recruiter_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          recruiter_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          recruiter_id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_live_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_question_sets: {
        Row: {
          candidate_id: string | null
          created_at: string
          id: string
          job_id: string | null
          questions: Json
          recruiter_id: string
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          questions?: Json
          recruiter_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          questions?: Json
          recruiter_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_question_sets_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruiter_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_question_sets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          apply_url: string | null
          company_name: string | null
          created_at: string
          description: string | null
          employer_logo: string | null
          id: string
          job_data: Json | null
          job_id: string
          job_title: string
          job_type: string | null
          location: string | null
          match_score: number | null
          salary: string | null
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apply_url?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          employer_logo?: string | null
          id?: string
          job_data?: Json | null
          job_id: string
          job_title: string
          job_type?: string | null
          location?: string | null
          match_score?: number | null
          salary?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apply_url?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          employer_logo?: string | null
          id?: string
          job_data?: Json | null
          job_id?: string
          job_title?: string
          job_type?: string | null
          location?: string | null
          match_score?: number | null
          salary?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_resumes: {
        Row: {
          created_at: string
          detected_experience_level: string | null
          detected_job_title: string | null
          detected_skills: string | null
          id: string
          original_file_url: string
          raw_resume_text: string | null
          resume_id: string | null
          structured_resume_json: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_experience_level?: string | null
          detected_job_title?: string | null
          detected_skills?: string | null
          id?: string
          original_file_url: string
          raw_resume_text?: string | null
          resume_id?: string | null
          structured_resume_json?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_experience_level?: string | null
          detected_job_title?: string | null
          detected_skills?: string | null
          id?: string
          original_file_url?: string
          raw_resume_text?: string | null
          resume_id?: string | null
          structured_resume_json?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_resumes_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_points_atomic: {
        Args: {
          p_cost: number
          p_description: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_plan:
        | "free"
        | "pro"
        | "enterprise"
        | "basic"
        | "publish_only"
      subscription_status: "active" | "inactive" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["free", "pro", "enterprise", "basic", "publish_only"],
      subscription_status: ["active", "inactive", "expired"],
    },
  },
} as const
