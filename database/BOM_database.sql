USE [OracleDB]
GO
/****** Object:  Table [dbo].[tbl_bom_detail]    Script Date: 10/28/2026 9:06:53 am ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tbl_bom_detail](
	[BOMDetailID] [int] IDENTITY(1,1) NOT NULL,
	[BOMID] [int] NOT NULL,
	[RMCode] [varchar](50) NOT NULL,
	[RMName] [varchar](255) NOT NULL,
	[QtyNeeds] [decimal](18, 4) NOT NULL,
	[BOM_UOM] [varchar](20) NOT NULL,
	[QtyDenominator] [decimal](18, 4) NULL,
	[UnitConversion] [decimal](18, 6) NULL,
	[Inv_UOM] [varchar](20) NOT NULL,
	[IsSubAssembly] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[BOMDetailID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[tbl_bom_header]    Script Date: 10/28/2026 9:06:53 am ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[tbl_bom_header](
	[BOMID] [int] IDENTITY(1,1) NOT NULL,
	[FormulaCode] [varchar](50) NOT NULL,
	[FGItemCode] [varchar](50) NOT NULL,
	[FGName] [varchar](255) NOT NULL,
	[Version] [int] NULL,
	[IsActive] [bit] NULL,
	[CreatedDate] [datetime2](7) NULL,
	[ModifiedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[BOMID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_tbl_bom_detail_BOMID]    Script Date: 10/28/2026 9:06:53 am ******/
CREATE NONCLUSTERED INDEX [IX_tbl_bom_detail_BOMID] ON [dbo].[tbl_bom_detail]
(
	[BOMID] ASC
)
INCLUDE ( 	[RMCode],
	[RMName],
	[QtyNeeds],
	[BOM_UOM],
	[QtyDenominator],
	[UnitConversion],
	[Inv_UOM],
	[IsSubAssembly]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_tbl_bom_detail_RMCode]    Script Date: 10/28/2026 9:06:53 am ******/
CREATE NONCLUSTERED INDEX [IX_tbl_bom_detail_RMCode] ON [dbo].[tbl_bom_detail]
(
	[RMCode] ASC,
	[IsSubAssembly] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_tbl_bom_header_FormulaCode]    Script Date: 10/28/2026 9:06:53 am ******/
CREATE NONCLUSTERED INDEX [IX_tbl_bom_header_FormulaCode] ON [dbo].[tbl_bom_header]
(
	[FormulaCode] ASC
)
INCLUDE ( 	[FGItemCode],
	[FGName],
	[IsActive]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
ALTER TABLE [dbo].[tbl_bom_detail] ADD  DEFAULT ((1.0)) FOR [QtyDenominator]
GO
ALTER TABLE [dbo].[tbl_bom_detail] ADD  DEFAULT ((1.0)) FOR [UnitConversion]
GO
ALTER TABLE [dbo].[tbl_bom_detail] ADD  DEFAULT ((0)) FOR [IsSubAssembly]
GO
ALTER TABLE [dbo].[tbl_bom_header] ADD  DEFAULT ((1)) FOR [Version]
GO
ALTER TABLE [dbo].[tbl_bom_header] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[tbl_bom_header] ADD  DEFAULT (getdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[tbl_bom_header] ADD  DEFAULT (getdate()) FOR [ModifiedDate]
GO
ALTER TABLE [dbo].[tbl_bom_detail]  WITH CHECK ADD FOREIGN KEY([BOMID])
REFERENCES [dbo].[tbl_bom_header] ([BOMID])
GO
