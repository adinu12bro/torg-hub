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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      barcodes: {
        Row: {
          code: string
          code_type: Database["public"]["Enums"]["code_type"]
          created_at: string
          id: string
          is_primary: boolean
          variant_id: string
        }
        Insert: {
          code: string
          code_type?: Database["public"]["Enums"]["code_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          variant_id: string
        }
        Update: {
          code?: string
          code_type?: Database["public"]["Enums"]["code_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          email: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          phone: string | null
          shop_name: string | null
          state: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          email?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          shop_name?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          email?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          shop_name?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          payment_method: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          new_qty: number
          previous_qty: number
          product_id: string
          purchase_id: string | null
          qty_change: number
          reason: string | null
          return_id: string | null
          sale_id: string | null
          stock_count_id: string | null
          unit_cost: number | null
          user_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          new_qty: number
          previous_qty: number
          product_id: string
          purchase_id?: string | null
          qty_change: number
          reason?: string | null
          return_id?: string | null
          sale_id?: string | null
          stock_count_id?: string | null
          unit_cost?: number | null
          user_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          new_qty?: number
          previous_qty?: number
          product_id?: string
          purchase_id?: string | null
          qty_change?: number
          reason?: string | null
          return_id?: string | null
          sale_id?: string | null
          stock_count_id?: string | null
          unit_cost?: number | null
          user_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          resource_id: string | null
          resource_type: string | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          method: string
          note: string | null
          received_by: string | null
          reference: string | null
          sale_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          method?: string
          note?: string | null
          received_by?: string | null
          reference?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          method?: string
          note?: string | null
          received_by?: string | null
          reference?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          buy_price: number | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          min_stock: number | null
          product_id: string
          selling_price: number | null
          size: string | null
          sku: string
          stock: number
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          buy_price?: number | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number | null
          product_id: string
          selling_price?: number | null
          size?: string | null
          sku: string
          stock?: number
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          buy_price?: number | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number | null
          product_id?: string
          selling_price?: number | null
          size?: string | null
          sku?: string
          stock?: number
          updated_at?: string
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          buy_price: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          high_volume_threshold: number
          id: string
          images: string[]
          min_stock: number
          moq: number
          name: string
          selling_price: number
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          subcategory_id: string | null
          supplier_id: string | null
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          brand?: string | null
          buy_price?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          high_volume_threshold?: number
          id?: string
          images?: string[]
          min_stock?: number
          moq?: number
          name: string
          selling_price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          subcategory_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          brand?: string | null
          buy_price?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          high_volume_threshold?: number
          id?: string
          images?: string[]
          min_stock?: number
          moq?: number
          name?: string
          selling_price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          subcategory_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          buy_price: number
          id: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity: number
          variant_id: string
        }
        Insert: {
          buy_price: number
          id?: string
          line_total?: number
          product_id: string
          purchase_id: string
          quantity: number
          variant_id: string
        }
        Update: {
          buy_price?: number
          id?: string
          line_total?: number
          product_id?: string
          purchase_id?: string
          quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          purchase_date: string
          reference_no: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          reference_no?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          reference_no?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          id: string
          quantity: number
          return_id: string
          sale_item_id: string
          unit_cost: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          id?: string
          quantity: number
          return_id: string
          sale_item_id: string
          unit_cost?: number
          unit_price?: number
          variant_id: string
        }
        Update: {
          id?: string
          quantity?: number
          return_id?: string
          sale_item_id?: string
          unit_cost?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          cost_reversed: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          reason: string | null
          refund_amount: number
          refund_method: string
          sale_id: string
        }
        Insert: {
          cost_reversed?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          reason?: string | null
          refund_amount?: number
          refund_method?: string
          sale_id: string
        }
        Update: {
          cost_reversed?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          reason?: string | null
          refund_amount?: number
          refund_method?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount: number
          id: string
          line_cost: number
          line_profit: number
          line_revenue: number
          product_id: string
          product_name: string
          quantity: number
          returned_qty: number
          sale_id: string
          unit_cost: number
          unit_price: number
          variant_id: string
          variant_label: string | null
        }
        Insert: {
          discount?: number
          id?: string
          line_cost?: number
          line_profit?: number
          line_revenue?: number
          product_id: string
          product_name: string
          quantity: number
          returned_qty?: number
          sale_id: string
          unit_cost?: number
          unit_price: number
          variant_id: string
          variant_label?: string | null
        }
        Update: {
          discount?: number
          id?: string
          line_cost?: number
          line_profit?: number
          line_revenue?: number
          product_id?: string
          product_name?: string
          quantity?: number
          returned_qty?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
          variant_id?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          balance: number
          cost: number
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          due_date: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          profit: number
          revenue: number
          sale_no: number
          staff_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance?: number
          cost?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          profit?: number
          revenue?: number
          sale_no?: number
          staff_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance?: number
          cost?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          profit?: number
          revenue?: number
          sale_no?: number
          staff_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stock_count_items: {
        Row: {
          difference: number | null
          id: string
          note: string | null
          physical_qty: number | null
          stock_count_id: string
          system_qty: number
          variant_id: string
        }
        Insert: {
          difference?: number | null
          id?: string
          note?: string | null
          physical_qty?: number | null
          stock_count_id: string
          system_qty?: number
          variant_id: string
        }
        Update: {
          difference?: number | null
          id?: string
          note?: string | null
          physical_qty?: number | null
          stock_count_id?: string
          system_qty?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["count_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      adjust_stock: {
        Args: {
          _qty_change: number
          _reason: string
          _type: Database["public"]["Enums"]["movement_type"]
          _variant_id: string
        }
        Returns: number
      }
      apply_stock_change: {
        Args: {
          _purchase_id?: string
          _qty_change: number
          _reason: string
          _return_id?: string
          _sale_id?: string
          _stock_count_id?: string
          _type: Database["public"]["Enums"]["movement_type"]
          _unit_cost?: number
          _variant_id: string
        }
        Returns: number
      }
      approve_stock_count: { Args: { _count_id: string }; Returns: undefined }
      cancel_sale: {
        Args: { _reason: string; _sale_id: string }
        Returns: undefined
      }
      complete_sale: { Args: { _payload: Json }; Returns: string }
      confirm_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      has_min_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _new: Json
          _prev: Json
          _reason: string
          _resource_id: string
          _resource_type: string
        }
        Returns: undefined
      }
      max_role_rank: { Args: { _user_id: string }; Returns: number }
      process_return: { Args: { _payload: Json }; Returns: string }
      record_payment: {
        Args: {
          _amount: number
          _method: string
          _reference: string
          _sale_id: string
        }
        Returns: string
      }
      role_rank: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "staff" | "manager" | "admin" | "super_admin"
      code_type: "barcode" | "qr"
      count_status: "open" | "pending_approval" | "approved" | "rejected"
      customer_status: "active" | "inactive" | "blocked"
      movement_type:
        | "receive"
        | "sale"
        | "adjustment"
        | "damage"
        | "loss"
        | "return"
        | "transfer"
        | "count"
        | "initial"
      payment_status: "paid" | "partial" | "unpaid" | "credit"
      product_status: "active" | "archived"
      purchase_status: "draft" | "confirmed" | "cancelled"
      sale_status: "completed" | "cancelled"
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
      app_role: ["staff", "manager", "admin", "super_admin"],
      code_type: ["barcode", "qr"],
      count_status: ["open", "pending_approval", "approved", "rejected"],
      customer_status: ["active", "inactive", "blocked"],
      movement_type: [
        "receive",
        "sale",
        "adjustment",
        "damage",
        "loss",
        "return",
        "transfer",
        "count",
        "initial",
      ],
      payment_status: ["paid", "partial", "unpaid", "credit"],
      product_status: ["active", "archived"],
      purchase_status: ["draft", "confirmed", "cancelled"],
      sale_status: ["completed", "cancelled"],
    },
  },
} as const
