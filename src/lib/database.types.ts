
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "approvals": {
                  Row: {
                    "approval_note": string | null,"approved_at": string,"approved_by": string | null,"cost_sgd": number,"created_at": string,"currency": string,"end_reason": string | null,"ended_at": string | null,"ended_by": string | null,"freight_allowance": number,"freight_currency": string,"freight_fx_rate": number,"freight_sgd": number,"fx_as_of": string | null,"fx_rate": number,"fx_source": string | null,"goods_sgd": number,"household_id": string,"id": string,"is_imported": boolean,"needs_reconciliation": boolean,"option_id": string,"order_override_note": string | null,"ordered_at": string | null,"ordered_by": string | null,"other_charges": number,"price_basis": Database["public"]['Enums']["price_basis"],"quantity": number,"required_item_id": string,"status": Database["public"]['Enums']["approval_status"],"superseded_by": string | null,"unit_price": number,"unresolved_checks": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_note"?: string | null,"approved_at"?: string,"approved_by"?: string | null,"cost_sgd": number,"created_at"?: string,"currency": string,"end_reason"?: string | null,"ended_at"?: string | null,"ended_by"?: string | null,"freight_allowance"?: number,"freight_currency"?: string,"freight_fx_rate": number,"freight_sgd": number,"fx_as_of"?: string | null,"fx_rate": number,"fx_source"?: string | null,"goods_sgd": number,"household_id": string,"id"?: string,"is_imported"?: boolean,"needs_reconciliation"?: boolean,"option_id": string,"order_override_note"?: string | null,"ordered_at"?: string | null,"ordered_by"?: string | null,"other_charges"?: number,"price_basis": Database["public"]['Enums']["price_basis"],"quantity": number,"required_item_id": string,"status"?: Database["public"]['Enums']["approval_status"],"superseded_by"?: string | null,"unit_price": number,"unresolved_checks"?: NonNullable<Json>
                  }
                  Update: {
                    "approval_note"?: string | null,"approved_at"?: string,"approved_by"?: string | null,"cost_sgd"?: number,"created_at"?: string,"currency"?: string,"end_reason"?: string | null,"ended_at"?: string | null,"ended_by"?: string | null,"freight_allowance"?: number,"freight_currency"?: string,"freight_fx_rate"?: number,"freight_sgd"?: number,"fx_as_of"?: string | null,"fx_rate"?: number,"fx_source"?: string | null,"goods_sgd"?: number,"household_id"?: string,"id"?: string,"is_imported"?: boolean,"needs_reconciliation"?: boolean,"option_id"?: string,"order_override_note"?: string | null,"ordered_at"?: string | null,"ordered_by"?: string | null,"other_charges"?: number,"price_basis"?: Database["public"]['Enums']["price_basis"],"quantity"?: number,"required_item_id"?: string,"status"?: Database["public"]['Enums']["approval_status"],"superseded_by"?: string | null,"unit_price"?: number,"unresolved_checks"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_required_item_id_fkey"
      columns: ["required_item_id"]
isOneToOne: false
      referencedRelation: "required_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_superseded_by_fkey"
      columns: ["superseded_by"]
isOneToOne: false
      referencedRelation: "approvals"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"household_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"household_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"household_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"budget_categories": {
                  Row: {
                    "budget": number | null,"created_at": string,"household_id": string,"id": string,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget"?: number | null,"created_at"?: string,"household_id": string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "budget"?: number | null,"created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"file_name": string,"household_id": string,"id": string,"kind": string,"mime_type": string | null,"option_id": string | null,"size_bytes": number | null,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"household_id": string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"option_id"?: string | null,"size_bytes"?: number | null,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"household_id"?: string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"option_id"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    }
                  ]
                },"exchange_rates": {
                  Row: {
                    "as_of": string,"created_at": string,"created_by": string | null,"currency": string,"household_id": string,"id": string,"is_manual": boolean,"rate_to_sgd": number,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "as_of": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"household_id": string,"id"?: string,"is_manual"?: boolean,"rate_to_sgd": number,"source": string
                  }
                  Update: {
                    "as_of"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"household_id"?: string,"id"?: string,"is_manual"?: boolean,"rate_to_sgd"?: number,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchange_rates_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"can_approve": boolean,"can_edit_budget": boolean,"can_export": boolean,"can_manage_items": boolean,"can_record_payments": boolean,"created_at": string,"display_name": string,"email": string,"household_id": string,"id": string,"invited_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"can_approve"?: boolean,"can_edit_budget"?: boolean,"can_export"?: boolean,"can_manage_items"?: boolean,"can_record_payments"?: boolean,"created_at"?: string,"display_name"?: string,"email": string,"household_id": string,"id"?: string,"invited_by"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"can_approve"?: boolean,"can_edit_budget"?: boolean,"can_export"?: boolean,"can_manage_items"?: boolean,"can_record_payments"?: boolean,"created_at"?: string,"display_name"?: string,"email"?: string,"household_id"?: string,"id"?: string,"invited_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "can_approve": boolean,"can_edit_budget": boolean,"can_export": boolean,"can_manage_items": boolean,"can_record_payments": boolean,"created_at": string,"display_name": string,"household_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_approve"?: boolean,"can_edit_budget"?: boolean,"can_export"?: boolean,"can_manage_items"?: boolean,"can_record_payments"?: boolean,"created_at"?: string,"display_name"?: string,"household_id": string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "can_approve"?: boolean,"can_edit_budget"?: boolean,"can_export"?: boolean,"can_manage_items"?: boolean,"can_record_payments"?: boolean,"created_at"?: string,"display_name"?: string,"household_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "address": string | null,"base_currency": string,"contingency": number,"created_at": string,"id": string,"name": string,"total_budget": number | null,"trip_end": string | null,"trip_start": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"base_currency"?: string,"contingency"?: number,"created_at"?: string,"id"?: string,"name": string,"total_budget"?: number | null,"trip_end"?: string | null,"trip_start"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"base_currency"?: string,"contingency"?: number,"created_at"?: string,"id"?: string,"name"?: string,"total_budget"?: number | null,"trip_end"?: string | null,"trip_start"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"import_batches": {
                  Row: {
                    "created_at": string,"file_name": string,"household_id": string,"id": string,"imported_by": string | null,"report": NonNullable<Json>,"summary": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_name": string,"household_id": string,"id"?: string,"imported_by"?: string | null,"report"?: NonNullable<Json>,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"household_id"?: string,"id"?: string,"imported_by"?: string | null,"report"?: NonNullable<Json>,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"location_items": {
                  Row: {
                    "household_id": string,"location_id": string,"required_item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"location_id": string,"required_item_id": string
                  }
                  Update: {
                    "household_id"?: string,"location_id"?: string,"required_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_items_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "shopping_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_items_required_item_id_fkey"
      columns: ["required_item_id"]
isOneToOne: false
      referencedRelation: "required_items"
      referencedColumns: ["id"]
    }
                  ]
                },"option_checks": {
                  Row: {
                    "created_at": string,"critical": boolean,"detail": string | null,"evidence": string | null,"household_id": string,"id": string,"option_id": string,"resolved_at": string | null,"resolved_by": string | null,"state": Database["public"]['Enums']["check_state"],"template_key": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"critical"?: boolean,"detail"?: string | null,"evidence"?: string | null,"household_id": string,"id"?: string,"option_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"state"?: Database["public"]['Enums']["check_state"],"template_key"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"critical"?: boolean,"detail"?: string | null,"evidence"?: string | null,"household_id"?: string,"id"?: string,"option_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"state"?: Database["public"]['Enums']["check_state"],"template_key"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_checks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "option_checks_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    }
                  ]
                },"option_comments": {
                  Row: {
                    "body": string,"created_at": string,"household_id": string,"id": string,"option_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"household_id": string,"id"?: string,"option_id": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"option_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_comments_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "option_comments_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    }
                  ]
                },"option_images": {
                  Row: {
                    "created_at": string,"height": number | null,"household_id": string,"id": string,"option_id": string,"sort_order": number,"storage_path": string,"thumb_path": string | null,"uploaded_by": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"household_id": string,"id"?: string,"option_id": string,"sort_order"?: number,"storage_path": string,"thumb_path"?: string | null,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"household_id"?: string,"id"?: string,"option_id"?: string,"sort_order"?: number,"storage_path"?: string,"thumb_path"?: string | null,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_images_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "option_images_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    }
                  ]
                },"option_preferences": {
                  Row: {
                    "household_id": string,"option_id": string,"updated_at": string,"user_id": string,"vote": Database["public"]['Enums']["preference_vote"]
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"option_id": string,"updated_at"?: string,"user_id"?: string,"vote": Database["public"]['Enums']["preference_vote"]
                  }
                  Update: {
                    "household_id"?: string,"option_id"?: string,"updated_at"?: string,"user_id"?: string,"vote"?: Database["public"]['Enums']["preference_vote"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_preferences_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "option_preferences_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"amount_sgd": number,"approval_id": string | null,"created_at": string,"currency": string,"fx_rate": number,"fx_source": string | null,"household_id": string,"id": string,"import_key": string | null,"is_imported": boolean,"kind": Database["public"]['Enums']["payment_kind"],"method": string | null,"needs_reconciliation": boolean,"notes": string | null,"paid_on": string,"receipt_document_id": string | null,"recorded_by": string | null,"reference": string | null,"required_item_id": string | null,"shared_cost_id": string | null,"supplier_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_sgd": number,"approval_id"?: string | null,"created_at"?: string,"currency": string,"fx_rate": number,"fx_source"?: string | null,"household_id": string,"id"?: string,"import_key"?: string | null,"is_imported"?: boolean,"kind": Database["public"]['Enums']["payment_kind"],"method"?: string | null,"needs_reconciliation"?: boolean,"notes"?: string | null,"paid_on": string,"receipt_document_id"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"required_item_id"?: string | null,"shared_cost_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"amount_sgd"?: number,"approval_id"?: string | null,"created_at"?: string,"currency"?: string,"fx_rate"?: number,"fx_source"?: string | null,"household_id"?: string,"id"?: string,"import_key"?: string | null,"is_imported"?: boolean,"kind"?: Database["public"]['Enums']["payment_kind"],"method"?: string | null,"needs_reconciliation"?: boolean,"notes"?: string | null,"paid_on"?: string,"receipt_document_id"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"required_item_id"?: string | null,"shared_cost_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_approval_id_fkey"
      columns: ["approval_id"]
isOneToOne: false
      referencedRelation: "approvals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_receipt_document_id_fkey"
      columns: ["receipt_document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_required_item_id_fkey"
      columns: ["required_item_id"]
isOneToOne: false
      referencedRelation: "required_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_shared_cost_id_fkey"
      columns: ["shared_cost_id"]
isOneToOne: false
      referencedRelation: "shared_costs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"product_options": {
                  Row: {
                    "ai_suggestions": Json | null,"colour": string | null,"configuration": string | null,"contact": string | null,"created_at": string,"created_by": string | null,"currency": string | null,"description": string | null,"dimensions": string | null,"freight_allowance": number | null,"freight_currency": string | null,"household_id": string,"id": string,"import_key": string | null,"material": string | null,"model_sku": string | null,"notes": string | null,"other_charges": number | null,"platform": string,"price": number | null,"price_basis": Database["public"]['Enums']["price_basis"],"price_note": string | null,"quantity": number,"required_item_id": string,"status": Database["public"]['Enums']["option_status"],"supplier_id": string | null,"supplier_name": string | null,"title": string,"updated_at": string,"url": string | null,"warranty_coverage": string | null,"warranty_duration": string | null,"warranty_exclusions": string | null,"warranty_local_service": Database["public"]['Enums']["tri_state"],"warranty_notes": string | null,"warranty_parts": Database["public"]['Enums']["tri_state"],"warranty_provided": Database["public"]['Enums']["tri_state"],"warranty_provider": string | null,"warranty_start_basis": string | null,"warranty_valid_sg": Database["public"]['Enums']["tri_state"],"warranty_verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_suggestions"?: Json | null,"colour"?: string | null,"configuration"?: string | null,"contact"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"description"?: string | null,"dimensions"?: string | null,"freight_allowance"?: number | null,"freight_currency"?: string | null,"household_id": string,"id"?: string,"import_key"?: string | null,"material"?: string | null,"model_sku"?: string | null,"notes"?: string | null,"other_charges"?: number | null,"platform"?: string,"price"?: number | null,"price_basis"?: Database["public"]['Enums']["price_basis"],"price_note"?: string | null,"quantity"?: number,"required_item_id": string,"status"?: Database["public"]['Enums']["option_status"],"supplier_id"?: string | null,"supplier_name"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"warranty_coverage"?: string | null,"warranty_duration"?: string | null,"warranty_exclusions"?: string | null,"warranty_local_service"?: Database["public"]['Enums']["tri_state"],"warranty_notes"?: string | null,"warranty_parts"?: Database["public"]['Enums']["tri_state"],"warranty_provided"?: Database["public"]['Enums']["tri_state"],"warranty_provider"?: string | null,"warranty_start_basis"?: string | null,"warranty_valid_sg"?: Database["public"]['Enums']["tri_state"],"warranty_verified"?: boolean
                  }
                  Update: {
                    "ai_suggestions"?: Json | null,"colour"?: string | null,"configuration"?: string | null,"contact"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"description"?: string | null,"dimensions"?: string | null,"freight_allowance"?: number | null,"freight_currency"?: string | null,"household_id"?: string,"id"?: string,"import_key"?: string | null,"material"?: string | null,"model_sku"?: string | null,"notes"?: string | null,"other_charges"?: number | null,"platform"?: string,"price"?: number | null,"price_basis"?: Database["public"]['Enums']["price_basis"],"price_note"?: string | null,"quantity"?: number,"required_item_id"?: string,"status"?: Database["public"]['Enums']["option_status"],"supplier_id"?: string | null,"supplier_name"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"warranty_coverage"?: string | null,"warranty_duration"?: string | null,"warranty_exclusions"?: string | null,"warranty_local_service"?: Database["public"]['Enums']["tri_state"],"warranty_notes"?: string | null,"warranty_parts"?: Database["public"]['Enums']["tri_state"],"warranty_provided"?: Database["public"]['Enums']["tri_state"],"warranty_provider"?: string | null,"warranty_start_basis"?: string | null,"warranty_valid_sg"?: Database["public"]['Enums']["tri_state"],"warranty_verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_options_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_options_required_item_id_fkey"
      columns: ["required_item_id"]
isOneToOne: false
      referencedRelation: "required_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_options_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"required_items": {
                  Row: {
                    "budget_category_id": string | null,"created_at": string,"created_by": string | null,"dimensions_finish": string | null,"estimate_unit": number | null,"household_id": string,"id": string,"import_snapshot": Json | null,"is_archived": boolean,"legacy_id": string | null,"legacy_status": string | null,"name": string,"needs_review": boolean,"notes": string | null,"photo_link": string | null,"priority_label": string | null,"purchase_by": string | null,"quantity": number,"reference_url": string | null,"review_note": string | null,"room_id": string,"source_decision_label": string | null,"sourcing": Database["public"]['Enums']["sourcing_pref"],"specification": string | null,"unit": string | null,"updated_at": string,"workbook_category": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"dimensions_finish"?: string | null,"estimate_unit"?: number | null,"household_id": string,"id"?: string,"import_snapshot"?: Json | null,"is_archived"?: boolean,"legacy_id"?: string | null,"legacy_status"?: string | null,"name": string,"needs_review"?: boolean,"notes"?: string | null,"photo_link"?: string | null,"priority_label"?: string | null,"purchase_by"?: string | null,"quantity"?: number,"reference_url"?: string | null,"review_note"?: string | null,"room_id": string,"source_decision_label"?: string | null,"sourcing"?: Database["public"]['Enums']["sourcing_pref"],"specification"?: string | null,"unit"?: string | null,"updated_at"?: string,"workbook_category"?: string | null
                  }
                  Update: {
                    "budget_category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"dimensions_finish"?: string | null,"estimate_unit"?: number | null,"household_id"?: string,"id"?: string,"import_snapshot"?: Json | null,"is_archived"?: boolean,"legacy_id"?: string | null,"legacy_status"?: string | null,"name"?: string,"needs_review"?: boolean,"notes"?: string | null,"photo_link"?: string | null,"priority_label"?: string | null,"purchase_by"?: string | null,"quantity"?: number,"reference_url"?: string | null,"review_note"?: string | null,"room_id"?: string,"source_decision_label"?: string | null,"sourcing"?: Database["public"]['Enums']["sourcing_pref"],"specification"?: string | null,"unit"?: string | null,"updated_at"?: string,"workbook_category"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "required_items_budget_category_id_fkey"
      columns: ["budget_category_id"]
isOneToOne: false
      referencedRelation: "budget_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "required_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "required_items_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "budget": number | null,"created_at": string,"household_id": string,"id": string,"is_whole_house": boolean,"legacy_prefix": string | null,"name": string,"sort_order": number,"source_sheet": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget"?: number | null,"created_at"?: string,"household_id": string,"id"?: string,"is_whole_house"?: boolean,"legacy_prefix"?: string | null,"name": string,"sort_order"?: number,"source_sheet"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "budget"?: number | null,"created_at"?: string,"household_id"?: string,"id"?: string,"is_whole_house"?: boolean,"legacy_prefix"?: string | null,"name"?: string,"sort_order"?: number,"source_sheet"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_costs": {
                  Row: {
                    "allocation": string,"amount": number,"amount_sgd": number,"applies_to": string,"created_at": string,"created_by": string | null,"currency": string,"fx_rate": number,"fx_source": string | null,"household_id": string,"id": string,"name": string,"notes": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation"?: string,"amount": number,"amount_sgd": number,"applies_to"?: string,"created_at"?: string,"created_by"?: string | null,"currency": string,"fx_rate": number,"fx_source"?: string | null,"household_id": string,"id"?: string,"name": string,"notes"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "allocation"?: string,"amount"?: number,"amount_sgd"?: number,"applies_to"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"fx_rate"?: number,"fx_source"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_costs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_locations": {
                  Row: {
                    "address": string | null,"address_verified": boolean,"categories": (string)[],"city": string | null,"created_at": string,"household_id": string,"id": string,"key": string,"name_en": string,"name_zh": string | null,"notes": string | null,"sort_order": number,"updated_at": string,"verification_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"address_verified"?: boolean,"categories"?: (string)[],"city"?: string | null,"created_at"?: string,"household_id": string,"id"?: string,"key": string,"name_en": string,"name_zh"?: string | null,"notes"?: string | null,"sort_order"?: number,"updated_at"?: string,"verification_note"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"address_verified"?: boolean,"categories"?: (string)[],"city"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"key"?: string,"name_en"?: string,"name_zh"?: string | null,"notes"?: string | null,"sort_order"?: number,"updated_at"?: string,"verification_note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_locations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"sourcing_guidelines": {
                  Row: {
                    "category": string,"household_id": string,"id": string,"important_check": string | null,"preferred": string | null,"rationale": string | null,"sort_order": number,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"household_id": string,"id"?: string,"important_check"?: string | null,"preferred"?: string | null,"rationale"?: string | null,"sort_order"?: number,"source"?: string
                  }
                  Update: {
                    "category"?: string,"household_id"?: string,"id"?: string,"important_check"?: string | null,"preferred"?: string | null,"rationale"?: string | null,"sort_order"?: number,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sourcing_guidelines_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "address": string | null,"city": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"email": string | null,"household_id": string,"id": string,"name": string,"notes": string | null,"phone": string | null,"platform": string,"shop_url": string | null,"updated_at": string,"wechat": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"household_id": string,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"platform"?: string,"shop_url"?: string | null,"updated_at"?: string,"wechat"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"platform"?: string,"shop_url"?: string | null,"updated_at"?: string,"wechat"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "approve_option":
{ Args: { "p_note"?: string,"p_option_id": string }; Returns: string
                           },
"cancel_approval":
{ Args: { "p_approval_id": string,"p_reason": string }; Returns: undefined
                           },
"claim_invites":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_household":
{ Args: { "p_display_name": string,"p_name": string }; Returns: string
                           },
"has_perm":
{ Args: { "hh": string,"perm": string }; Returns: boolean
                           },
"is_member":
{ Args: { "hh": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "hh": string }; Returns: boolean
                           },
"latest_rate":
{ Args: { "p_currency": string,"p_household": string }; Returns: {
              "as_of": string,"rate": number,"source": string
            }[]
                           },
"mark_ordered":
{ Args: { "p_approval_id": string,"p_override_note"?: string }; Returns: undefined
                           },
"record_imported_commitment":
{ Args: { "p_cost_sgd": number,"p_note": string,"p_option_id": string }; Returns: string
                           },
"revoke_approval":
{ Args: { "p_approval_id": string,"p_reason"?: string }; Returns: undefined
                           },
"try_uuid":
{ Args: { "t": string }; Returns: string
                           }
          }
          Enums: {
            "approval_status": "active"|"superseded"|"revoked"|"cancelled","check_state": "pending"|"confirmed"|"not_applicable"|"failed","member_role": "owner"|"member","option_status": "wishlist"|"shortlisted"|"pending_confirmation"|"approved"|"ordered"|"cancelled","payment_kind": "deposit"|"progress"|"balance"|"full"|"refund"|"other","preference_vote": "love"|"like"|"unsure"|"no","price_basis": "observed"|"estimate"|"quoted"|"confirmed","sourcing_pref": "china"|"singapore"|"compare"|"undecided","tri_state": "yes"|"no"|"unknown"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "approval_status": ["active", "superseded", "revoked", "cancelled"],"check_state": ["pending", "confirmed", "not_applicable", "failed"],"member_role": ["owner", "member"],"option_status": ["wishlist", "shortlisted", "pending_confirmation", "approved", "ordered", "cancelled"],"payment_kind": ["deposit", "progress", "balance", "full", "refund", "other"],"preference_vote": ["love", "like", "unsure", "no"],"price_basis": ["observed", "estimate", "quoted", "confirmed"],"sourcing_pref": ["china", "singapore", "compare", "undecided"],"tri_state": ["yes", "no", "unknown"]
          }
        }
} as const
