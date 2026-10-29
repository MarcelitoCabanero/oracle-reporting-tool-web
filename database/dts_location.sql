USE [OracleDB]
GO
/****** Object:  Table [dbo].[dts_location]    Script Date: 10/29/2026 7:48:05 am ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dts_location](
	[LOCATIONID] [int] NOT NULL,
	[LOCATIONNAME] [varchar](50) NOT NULL,
	[ORGLOCATIONREF] [varchar](50) NOT NULL,
	[username] [varchar](50) NULL,
	[password] [varchar](50) NULL,
	[access] [varchar](50) NULL,
	[IsActive] [bit] NOT NULL
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[dts_location] ADD  DEFAULT ((1)) FOR [IsActive]
GO
